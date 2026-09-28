const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const fs = require("fs");
const path = require("path");

// العرض = بانر للعرض فقط: صورة + عنوان + وصف + تواريخ.
// ما فيش خصم على المنتجات، وما فيش ربط بمنتجات/تصنيفات/ماركات.
// البانر إعلاني فقط وبيظهر في سلايدر الصفحة الرئيسية.

// ================= دالة مساعدة لتحويل البيانات =================
const convertOfferData = (data) => {
  const converted = { ...data };

  if (converted.displayOrder !== undefined && converted.displayOrder !== null && converted.displayOrder !== "") {
    converted.displayOrder = parseInt(converted.displayOrder) || 0;
  }

  if (converted.startDate) converted.startDate = new Date(converted.startDate);
  if (converted.endDate) converted.endDate = new Date(converted.endDate);

  return converted;
};

// ================= Controllers =================

// GET /api/offers - العروض النشطة للسلايدر
exports.getActiveOffers = async (req, res) => {
  try {
    const now = new Date();

    const offers = await prisma.offer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    // زيادة عداد المشاهدات
    if (offers.length > 0) {
      await Promise.all(
        offers.map((offer) =>
          prisma.offer.update({
            where: { id: offer.id },
            data: { clickCount: { increment: 1 } },
          })
        )
      );
    }

    return sendSuccess(res, { offers }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/offers/:id - تفاصيل عرض معين
exports.getOfferById = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });

    if (!offer) {
      return sendFail(res, { message: "العرض غير موجود" }, 404);
    }

    // زيادة عداد النقرات
    await prisma.offer.update({
      where: { id: offerId },
      data: { clickCount: { increment: 1 } },
    });

    return sendSuccess(res, { offer }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ================= Admin Controllers =================

// POST /api/admin/offers - إنشاء عرض جديد
exports.createOffer = async (req, res) => {
  try {
    const { title, description, startDate, endDate, isActive, displayOrder } = req.body;

    if (endDate && startDate && new Date(endDate) <= new Date(startDate)) {
      return sendFail(res, "تاريخ النهاية لازم يكون بعد تاريخ البداية", 400);
    }

    const offerData = convertOfferData({
      title,
      description: description || null,
      startDate,
      endDate,
      displayOrder: displayOrder ?? 0,
    });

    const image = req.file ? `/uploads/offers/${req.file.filename}` : null;

    const offer = await prisma.offer.create({
      data: {
        ...offerData,
        image,
        ...(isActive !== undefined ? { isActive: isActive === true || isActive === "true" } : {}),
      },
    });

    return sendSuccess(res, { offer, message: "تم إنشاء العرض بنجاح" }, 201);
  } catch (error) {
    // إذا فشل الإنشاء، احذف الصورة المرفوعة عشان ما تبقاش معلّقة
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* الصورة اتمسحت خلاص أو مش قابلة للحذف - مش مهمة */
      }
    }
    return sendError(res, error.message, 500);
  }
};

// PUT /api/admin/offers/:id - تحديث عرض
exports.updateOffer = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const { title, description, startDate, endDate, isActive, displayOrder } = req.body;

    const existing = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!existing) {
      return sendFail(res, { message: "العرض غير موجود" }, 404);
    }

    // تحقق من التواريخ على السجل بعد الدمج (التحديث جزئي)
    const nextStart = startDate !== undefined ? new Date(startDate) : existing.startDate;
    const nextEnd = endDate !== undefined ? new Date(endDate) : existing.endDate;
    if (nextEnd <= nextStart) {
      return sendFail(res, "تاريخ النهاية لازم يكون بعد تاريخ البداية", 400);
    }

    const offerData = convertOfferData({ title, description, startDate, endDate, displayOrder });

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (startDate !== undefined) data.startDate = offerData.startDate;
    if (endDate !== undefined) data.endDate = offerData.endDate;
    if (displayOrder !== undefined) data.displayOrder = offerData.displayOrder;
    if (isActive !== undefined) data.isActive = isActive === true || isActive === "true";

    // لو فيه صورة جديدة، امسح القديمة عشان ما تتراكمش
    if (req.file) {
      if (existing.image) removeOfferImage(existing.image);
      data.image = `/uploads/offers/${req.file.filename}`;
    }

    const offer = await prisma.offer.update({ where: { id: offerId }, data });

    return sendSuccess(res, { offer, message: "تم تحديث العرض بنجاح" }, 200);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* تجاهل */
      }
    }
    return sendError(res, error.message, 500);
  }
};

// GET /api/admin/offers - جميع العروض (للأدمن)
exports.getAllOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, q } = req.query;

    const where = {};
    if (isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    if (q && q.trim()) {
      const keyword = q.trim();
      where.OR = [{ title: { contains: keyword } }, { description: { contains: keyword } }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const offers = await prisma.offer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    const total = await prisma.offer.count({ where });

    return sendSuccess(
      res,
      {
        offers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// DELETE /api/admin/offers/:id - حذف عرض
exports.deleteOffer = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      return sendFail(res, { message: "العرض غير موجود" }, 404);
    }

    if (offer.image) removeOfferImage(offer.image);

    await prisma.offer.delete({ where: { id: offerId } });

    return sendSuccess(res, { message: "تم حذف العرض بنجاح" }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/admin/offers/:id/toggle - تفعيل/تعطيل عرض
exports.toggleOffer = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      return sendFail(res, { message: "العرض غير موجود" }, 404);
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: { isActive: !offer.isActive },
    });

    return sendSuccess(res, { offer: updatedOffer, message: "تم تحديث حالة العرض" }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// حذف ملف صورة العرض من مجلد uploads
function removeOfferImage(imagePath) {
  try {
    // الصورة مخزّنة كـ "/uploads/offers/xxx.png"
    const relative = imagePath.replace(/^\/+/, "");
    const full = path.join(__dirname, "..", relative);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (_) {
    // فشل حذف الصورة ما لازمش يوقف حذف العرض
  }
}
