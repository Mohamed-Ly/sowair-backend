// controllers/wallet.controller.js
//
// محفظة المندوب: الرصيد يُحسب من سجل WalletTransaction
//   balance = Σ amountCents  (EARNING ومكوّنات ADJUSTMENT موجبة، SETTLEMENT سالبة)
// عمولة التوصيل (EARNING) بتتولد تلقائياً داخل settleDelivery — هنا بنتعامل
// مع القراءة للمندوب/الأدمن + التسويات اليدوية (SETTLEMENT) والتصحيحات (ADJUSTMENT).
const prisma = require("../config/prisma");
const {
  sendSuccess,
  sendFail,
  sendError,
  businessError,
  isBusinessError,
} = require("../utils/responseHelper");

// يجمع سجلات محفظة مندوب إلى ملخص { earnedCents, settledCents, balanceCents, adjustmentCents }
async function getWalletTotals(courierId) {
  const groups = await prisma.walletTransaction.groupBy({
    by: ["type"],
    where: { courierId },
    _sum: { amountCents: true },
  });

  const totals = { earnedCents: 0, settledCents: 0, adjustmentCents: 0 };
  for (const g of groups) {
    const sum = g._sum.amountCents || 0;
    if (g.type === "EARNING") totals.earnedCents += sum;
    else if (g.type === "SETTLEMENT") totals.settledCents += sum; // سالب
    else if (g.type === "ADJUSTMENT") totals.adjustmentCents += sum; // موقّع (±)
  }

  return {
    ...totals,
    // رصيد صافي صحيح يدوياً (يتدرّج لصفر بدل النزول تحت الصفر إن حصل احتساب قديم)
    balanceCents: Math.max(0, totals.earnedCents + totals.adjustmentCents + totals.settledCents),
  };
}

// GET /api/admin/wallets - كل المندوبين مع ملخص الحساب + أداء التوصيل
exports.getAdminWallets = async (req, res) => {
  try {
    const deliverers = await prisma.user.findMany({
      where: { role: "DELIVERY" },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: "asc" },
    });

    // كل التسليمات المكتملة: عددها + المحصّل + المنتجات المسلّمة (لكل مندوب)
    const assignments = await prisma.deliveryAssignment.findMany({
      where: { status: "DELIVERED" },
      select: {
        deliveryId: true,
        order: {
          select: {
            collectedCents: true,
            items: { select: { deliveredQty: true } },
          },
        },
      },
    });

    const stats = new Map();
    for (const a of assignments) {
      let s = stats.get(a.deliveryId);
      if (!s) {
        s = { deliveries: 0, deliveredProducts: 0, collectedCents: 0 };
        stats.set(a.deliveryId, s);
      }
      s.deliveries += 1;
      s.collectedCents += a.order.collectedCents;
      s.deliveredProducts += a.order.items.reduce((sum, i) => sum + i.deliveredQty, 0);
    }

    // أحدث تسوية صرف لكل مندوب (في السجل) — أول ظهور = الأحدث
    const settlements = await prisma.walletTransaction.findMany({
      where: { type: "SETTLEMENT" },
      orderBy: { createdAt: "desc" },
      select: { courierId: true, createdAt: true },
    });
    const lastSettledMap = new Map();
    for (const s of settlements) {
      if (!lastSettledMap.has(s.courierId)) lastSettledMap.set(s.courierId, s.createdAt);
    }

    const wallets = [];
    for (const d of deliverers) {
      const totals = await getWalletTotals(d.id);
      const st = stats.get(d.id) || { deliveries: 0, deliveredProducts: 0, collectedCents: 0 };
      wallets.push({
        courierId: d.id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        deliveries: st.deliveries,
        deliveredProducts: st.deliveredProducts,
        collectedCents: st.collectedCents,
        wallet: totals,
        lastSettledAt: lastSettledMap.get(d.id) ?? null,
      });
    }

    return sendSuccess(res, { wallets }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/admin/wallets/:courierId/transactions - سجل حركات مندوب (للوحة الأدمن)
exports.getCourierTransactions = async (req, res) => {
  try {
    const courierId = parseInt(req.params.courierId);
    const courier = await prisma.user.findFirst({
      where: { id: courierId, role: "DELIVERY" },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!courier) businessError("المندوب غير موجود");

    const transactions = await prisma.walletTransaction.findMany({
      where: { courierId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return sendSuccess(
      res,
      {
        courier,
        wallet: await getWalletTotals(courierId),
        transactions,
      },
      200
    );
  } catch (error) {
    if (isBusinessError(error)) return sendFail(res, { message: error.message }, error.statusCode);
    return sendError(res, error.message, 500);
  }
};

// POST /api/admin/wallets/:courierId/settle - صرف رصيد (يدوي)
// body: { amountCents, method?, note? }
exports.settleWallet = async (req, res) => {
  try {
    const courierId = parseInt(req.params.courierId);
    const { amountCents, method, note } = req.body;

    const courier = await prisma.user.findFirst({
      where: { id: courierId, role: "DELIVERY" },
      select: { id: true, name: true },
    });
    if (!courier) businessError("المندوب غير موجود");

    const totals = await getWalletTotals(courierId);
    if (amountCents > totals.balanceCents) {
      businessError(
        `الرصيد الحالي ${totals.balanceCents} قرش — لا يمكن صرف ${amountCents} قرش`
      );
    }

    const transaction = await prisma.walletTransaction.create({
      data: {
        courierId,
        type: "SETTLEMENT",
        amountCents: -amountCents,
        method: method || "نقدي",
        note: note || "صرف رصيد محفظة",
      },
    });

    const after = await getWalletTotals(courierId);
    return sendSuccess(
      res,
      {
        transaction,
        wallet: after,
        message: `تم صرف ${amountCents} قرش بنجاح`,
      },
      200
    );
  } catch (error) {
    if (isBusinessError(error)) return sendFail(res, { message: error.message }, error.statusCode);
    return sendError(res, error.message, 500);
  }
};

// POST /api/admin/wallets/:courierId/adjust - تصحيح يدوي (±)
// body: { amountCents, direction: ADD|REMOVE, note? }
exports.adjustWallet = async (req, res) => {
  try {
    const courierId = parseInt(req.params.courierId);
    const { amountCents, direction, note } = req.body;

    const courier = await prisma.user.findFirst({
      where: { id: courierId, role: "DELIVERY" },
      select: { id: true, name: true },
    });
    if (!courier) businessError("المندوب غير موجود");

    const signed = direction === "REMOVE" ? -amountCents : amountCents;

    // في اتجاه الخصم لازم الرصيد يغطي المبلغ (مفيش رصيد سالب)
    if (direction === "REMOVE") {
      const totals = await getWalletTotals(courierId);
      if (amountCents > totals.balanceCents) {
        businessError(`الرصيد الحالي ${totals.balanceCents} قرش — لا يمكن خصم ${amountCents} قرش`);
      }
    }

    const transaction = await prisma.walletTransaction.create({
      data: {
        courierId,
        type: "ADJUSTMENT",
        amountCents: signed,
        note:
          note ||
          (direction === "REMOVE" ? "تصحيح خصم يدوي" : "تصحيح إضافة يدوي"),
      },
    });

    const after = await getWalletTotals(courierId);
    return sendSuccess(
      res,
      {
        transaction,
        wallet: after,
        message: "تم تسجيل التصحيح",
      },
      200
    );
  } catch (error) {
    if (isBusinessError(error)) return sendFail(res, { message: error.message }, error.statusCode);
    return sendError(res, error.message, 500);
  }
};

// ======================= للمندوب نفسه =======================

// GET /api/delivery/wallet - محفظتي (للمندوب): الرصيد + سجل الحركات + ملخص تسليماتي
exports.getMyWallet = async (req, res) => {
  try {
    const userId = req.user.sub;

    const [transactions, myDeliveries] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { courierId: userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.deliveryAssignment.findMany({
        where: { deliveryId: userId, status: "DELIVERED" },
        select: {
          deliveredAt: true,
          order: {
            select: {
              collectedCents: true,
              items: { select: { deliveredQty: true } },
            },
          },
        },
      }),
    ]);

    const totals = await getWalletTotals(userId);

    const deliveriesCount = myDeliveries.length;
    const collectedCents = myDeliveries.reduce((s, a) => s + a.order.collectedCents, 0);
    const deliveredProducts = myDeliveries.reduce(
      (s, a) => s + a.order.items.reduce((x, i) => x + i.deliveredQty, 0),
      0
    );

    // عمولة الشهر الحالي (لتوعية بسيطة في شاشة المحفظة)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEarningCents = transactions
      .filter((t) => t.type === "EARNING" && t.createdAt >= monthStart)
      .reduce((s, t) => s + t.amountCents, 0);

    return sendSuccess(
      res,
      {
        wallet: totals,
        deliveriesCount,
        deliveredProducts,
        collectedCents,
        monthEarningCents,
        transactions,
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};