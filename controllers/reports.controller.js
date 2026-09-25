const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const ArabicReshaper = require("arabic-reshaper");
const bidiFactory = require("bidi-js");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");

const bidi = bidiFactory();

// ========================== Helpers ==========================
const VALID_GRANULARITIES = ["day", "week", "month"];
const CURRENCY = "د.ل";

// إعادة ترتيب النص العربي (RTL + تشكيل أحرف) لعرضه بشكل صحيح في ملفات PDF
function arabicToVisual(text) {
  const src = String(text ?? "");
  if (!/[\u0600-\u06FF]/.test(src)) return src;
  const shaped = ArabicReshaper.convertArabic(src);
  const { levels, paragraphs } = bidi.getEmbeddingLevels(shaped, null);
  const chars = shaped.split("");
  bidi.getReorderSegments(shaped, { levels, paragraphs }).forEach(([s, e]) => {
    const seg = chars.slice(s, e + 1);
    for (let i = s; i <= e; i++) chars[i] = seg[e - i];
  });
  const mirrored = bidi.getMirroredCharactersMap(shaped, { levels, paragraphs });
  mirrored.forEach((ch, i) => {
    chars[i] = ch;
  });
  return chars.join("");
}

function parseRange(from, to, fallbackDays = 30) {
  const now = new Date();
  let start;
  let end;
  if (from && to) {
    start = new Date(from);
    end = new Date(to);
    if (isNaN(start) || isNaN(end)) throw new Error("INVALID_DATE");
  } else {
    end = now;
    start = new Date(end);
    // فقط نبدأ من بداية اليوم عند استخدام fallback
    start.setDate(start.getDate() - (fallbackDays - 1));
    start.setHours(0, 0, 0, 0);
  }
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatCents(cents) {
  return (cents / 100).toFixed(2);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // الإثنين = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketKey(date, granularity) {
  const d = new Date(date);
  if (granularity === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const w = startOfWeek(d);
    return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, "0")}-${String(
      w.getDate()
    ).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysBetween(start, end) {
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

// بناء قائمة الفترات الفارغة بين start و end حسب granularity
function buildEmptyBuckets(start, end, granularity) {
  const buckets = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = bucketKey(cursor, granularity);
    const exists = buckets.find((b) => b.key === key);
    if (!exists) {
      buckets.push({ key, label: key, orders: 0, revenueCents: 0 });
    }
    if (granularity === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else if (granularity === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return buckets;
}

function toCSV(headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  return "\uFEFF" + lines.join("\r\n"); // BOM لدعم العربية في Excel
}

// Arabic-capable font: خط Cairo المرفق مع المشروع، ثم خطوط النظام الاحتياطية
function registerArabicFont(doc) {
  const bundledFont = path.join(__dirname, "..", "fonts", "Cairo-Regular.ttf");
  const candidates = [
    process.env.ARABIC_FONT_PATH,
    bundledFont,
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\simsun.ttc",
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      doc.registerFont("main", p);
      return true;
    }
  }
  return false;
}

function buildPDF({ title, periodLabel, headers, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const hasArabic = registerArabicFont(doc);
    if (hasArabic) {
      doc.font("main");
    } else {
      doc.font("Helvetica");
    }

    doc
      .fontSize(18)
      .fillColor("#111827")
      .text(arabicToVisual(title), { align: "center" });
    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .text(arabicToVisual(periodLabel), { align: "center" });
    doc.moveDown();

    const tableLeft = 40;
    const tableWidth = doc.page.width - 80;
    const colWidth = Math.max(70, Math.min(140, tableWidth / headers.length));
    const rowHeight = 22;

    // رأس الجدول
    let y = doc.y;
    doc
      .rect(tableLeft, y, tableWidth, rowHeight)
      .fill("#4F46E5");
    doc.fillColor("#ffffff").fontSize(9);
    let x = tableLeft;
    headers.forEach((h) => {
      doc.text(arabicToVisual(h), x + 4, y + 6, {
        width: colWidth - 8,
        align: "right",
      });
      x += colWidth;
    });
    y += rowHeight;

    // الصفوف
    rows.forEach((row, i) => {
      if (y + rowHeight > doc.page.height - 50) {
        doc.addPage();
        y = 40;
      }
      if (i % 2 === 0) {
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#F3F4F6");
      }
      doc.fillColor("#111827").fontSize(9);
      x = tableLeft;
      row.forEach((cell) => {
        doc.text(arabicToVisual(String(cell ?? "")), x + 4, y + 6, {
          width: colWidth - 8,
          align: "right",
        });
        x += colWidth;
      });
      y += rowHeight;
    });

    doc
      .fontSize(8)
      .fillColor("#9CA3AF")
      .text(`Generated on ${new Date().toLocaleString()}`, 40, y + 16, {
        align: "center",
      });
    doc.end();
  });
}

// ========================== دالة واحدة لالتقاط بيانات المبيعات ==========================
async function collectSalesData(start, end) {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      userId: true,
    },
  });

  const done = orders.filter((o) => o.status !== "CANCELLED");
  const revenueSum = done.reduce((s, o) => s + o.totalCents, 0);
  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;

  return { orders, done, revenueSum, delivered, cancelled };
}

// ========================== 1) التقارير المجمعة ==========================
exports.getSummaryReport = async (req, res) => {
  try {
    const { from, to, granularity = "day" } = req.query;
    const g = VALID_GRANULARITIES.includes(granularity) ? granularity : "day";
    const { start, end } = parseRange(from, to);

    const { orders, done, revenueSum, delivered, cancelled } =
      await collectSalesData(start, end);

    // التوزيع حسب الحالة
    const byStatus = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    // تجميع حسب الفترة
    const buckets = buildEmptyBuckets(start, end, g);
    orders.forEach((o) => {
      const key = bucketKey(o.createdAt, g);
      const b = buckets.find((x) => x.key === key);
      if (!b) return;
      b.orders += 1;
      if (o.status !== "CANCELLED") b.revenueCents += o.totalCents;
    });

    const totalOrders = orders.length;
    const summary = {
      period: { from: start.toISOString(), to: end.toISOString(), granularity: g },
      totalOrders,
      deliveredOrders: delivered,
      cancelledOrders: cancelled,
      totalRevenueCents: revenueSum,
      totalRevenue: `${formatCents(revenueSum)} ${CURRENCY}`,
      averageOrderValueCents: totalOrders ? Math.round(revenueSum / totalOrders) : 0,
      byStatus,
      byPeriod: buckets,
    };

    return sendSuccess(res, { report: summary }, 200);
  } catch (error) {
    if (error.message === "INVALID_DATE") {
      return sendFail(res, { message: "صيغة التاريخ غير صحيحة" }, 400);
    }
    return sendError(res, error.message, 500);
  }
};

// ========================== 2) أفضل المنتجات مبيعاً ==========================
exports.getProductsReport = async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const { start, end } = parseRange(from, to);

    const items = await prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
      },
      select: {
        qty: true,
        unitPriceCents: true,
        variant: {
          select: {
            option1: true,
            option2: true,
            product: {
              select: {
                id: true,
                name: true,
                category: { select: { name: true } },
                brand: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // تجميع حسب المنتج
    const map = new Map();
    items.forEach((it) => {
      const p = it.variant.product;
      const key = p.id;
      const entry = map.get(key) || {
        productId: p.id,
        name: p.name,
        category: p.category?.name || "-",
        brand: p.brand?.name || "-",
        variant: [it.variant.option1, it.variant.option2].filter(Boolean).join(" - "),
        totalQty: 0,
        revenueCents: 0,
      };
      entry.totalQty += it.qty;
      entry.revenueCents += it.unitPriceCents * it.qty;
      map.set(key, entry);
    });

    const products = Array.from(map.values())
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, Math.max(1, Math.min(parseInt(limit) || 10, 100)))
      .map((p) => ({
        ...p,
        revenue: `${formatCents(p.revenueCents)} ${CURRENCY}`,
      }));

    return sendSuccess(res, { report: { period: { from: start.toISOString(), to: end.toISOString() }, count: products.length, products } }, 200);
  } catch (error) {
    if (error.message === "INVALID_DATE") {
      return sendFail(res, { message: "صيغة التاريخ غير صحيحة" }, 400);
    }
    return sendError(res, error.message, 500);
  }
};

// ========================== 3) حركة حالات الطلبات ==========================
exports.getOrderStatusReport = async (req, res) => {
  try {
    const { from, to, granularity = "day" } = req.query;
    const g = VALID_GRANULARITIES.includes(granularity) ? granularity : "day";
    const { start, end } = parseRange(from, to);

    const { orders } = await collectSalesData(start, end);

    const byStatus = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    // سجل تغيير الحالات
    const logs = await prisma.orderStatusLog.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { status: true, createdAt: true, actorType: true },
    });

    const buckets = buildEmptyBuckets(start, end, g);
    logs.forEach((l) => {
      const key = bucketKey(l.createdAt, g);
      const b = buckets.find((x) => x.key === key);
      if (!b) return;
      b[`s_${l.status}`] = (b[`s_${l.status}`] || 0) + 1;
    });

    // عدد الحركات حسب الفاعل
    const byActor = {};
    logs.forEach((l) => {
      const a = l.actorType || "SYSTEM";
      byActor[a] = (byActor[a] || 0) + 1;
    });

    return sendSuccess(
      res,
      { report: { period: { from: start.toISOString(), to: end.toISOString() }, byStatus, byActor, timeline: buckets } },
      200
    );
  } catch (error) {
    if (error.message === "INVALID_DATE") {
      return sendFail(res, { message: "صيغة التاريخ غير صحيحة" }, 400);
    }
    return sendError(res, error.message, 500);
  }
};

// ========================== 4) التصدير CSV / PDF ==========================
exports.exportReport = async (req, res) => {
  try {
    const { from, to, format = "csv", type = "sales", granularity = "day" } = req.query;
    const { start, end } = parseRange(from, to);
    const fm = ["csv", "pdf"].includes(format) ? format : "csv";

    const periodLabel = `الفترة: ${start.toISOString().slice(0, 10)} إلى ${end.toISOString().slice(0, 10)}`;

    let headers = [];
    let rows = [];
    let title = "";

    if (type === "products") {
      title = "تقرير المنتجات الأكثر مبيعاً";
      headers = ["المنتج", "التصنيف", "الماركة", "المتغير", "الكمية", "الإيراد"];
      const map = new Map();
      const items = await prisma.orderItem.findMany({
        where: {
          order: { createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
        },
        select: {
          qty: true,
          unitPriceCents: true,
          variant: {
            select: {
              option1: true,
              option2: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { name: true } },
                  brand: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      items.forEach((it) => {
        const p = it.variant.product;
        const e = map.get(p.id) || {
          name: p.name,
          category: p.category?.name || "-",
          brand: p.brand?.name || "-",
          variant: [it.variant.option1, it.variant.option2].filter(Boolean).join(" - "),
          qty: 0,
          rev: 0,
        };
        e.qty += it.qty;
        e.rev += it.unitPriceCents * it.qty;
        map.set(p.id, e);
      });
      rows = Array.from(map.values())
        .sort((a, b) => b.qty - a.qty)
        .map((r) => [r.name, r.category, r.brand, r.variant, r.qty, `${formatCents(r.rev)} ${CURRENCY}`]);
    } else if (type === "orders") {
      title = "تقرير حركة حالات الطلبات";
      headers = ["الحالة", "عدد الطلبات"];
      const { orders } = await collectSalesData(start, end);
      const byStatus = {};
      orders.forEach((o) => {
        byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      });
      rows = Object.entries(byStatus).sort().map(([s, n]) => [s, n]);
    } else {
      // sales (افتراضي)
      title = "تقرير المبيعات";
      headers = ["الفترة", "عدد الطلبات", "الإيراد"];
      const { orders, done, revenueSum } = await collectSalesData(start, end);
      const g = VALID_GRANULARITIES.includes(granularity) ? granularity : "day";
      const buckets = buildEmptyBuckets(start, end, g);
      orders.forEach((o) => {
        const key = bucketKey(o.createdAt, g);
        const b = buckets.find((x) => x.key === key);
        if (!b) return;
        b.orders += 1;
        if (o.status !== "CANCELLED") b.revenueCents += o.totalCents;
      });
      rows = buckets
        .filter((b) => b.orders > 0)
        .map((b) => [b.label, b.orders, `${formatCents(b.revenueCents)} ${CURRENCY}`]);
    }

    if (fm === "csv") {
      const csv = toCSV(headers, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${type}-${Date.now()}.csv"`
      );
      return res.send(csv);
    }

    // PDF
    const pdf = await buildPDF({ title, periodLabel, headers, rows });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${type}-${Date.now()}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    if (error.message === "INVALID_DATE") {
      return sendFail(res, { message: "صيغة التاريخ غير صحيحة" }, 400);
    }
    return sendError(res, error.message, 500);
  }
};