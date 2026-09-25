const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const fs = require("fs");

// ================= دالة مساعدة لتحويل البيانات =================
const convertOfferData = (data) => {
  const converted = { ...data };

  console.log("🔄 Converting offer data:", data);

  // الحقول الرقمية
  const numericFields = [
    "discountPercentage",
    "discountAmount",
    "minPurchaseAmount",
    "maxDiscountAmount",
    "displayOrder",
  ];

  numericFields.forEach((field) => {
    const value = converted[field];
    if (value === undefined) {
      // الحقل لم يُرسل: لا تتطرق له (مهم لتحديث جزئي)
      return;
    }
    if (value === null || value === "") {
      converted[field] = null;
      console.log(`➖ Set ${field} to null`);
    } else {
      converted[field] = parseInt(value);
      console.log(
        `🔢 Converted ${field}: ${data[field]} -> ${converted[field]}`
      );
    }
  });

  // تحويل التواريخ
  if (converted.startDate) {
    converted.startDate = new Date(converted.startDate);
    console.log(
      `📅 Converted startDate: ${data.startDate} -> ${converted.startDate}`
    );
  }

  if (converted.endDate) {
    converted.endDate = new Date(converted.endDate);
    console.log(
      `📅 Converted endDate: ${data.endDate} -> ${converted.endDate}`
    );
  }

  console.log("✅ Final converted data:", converted);
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
      include: {
        offerProducts: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
                brand: true,
              },
            },
          },
        },
        offerCategories: {
          include: {
            category: true,
          },
        },
        offerBrands: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    // زيادة عداد المشاهدات
    await Promise.all(
      offers.map((offer) =>
        prisma.offer.update({
          where: { id: offer.id },
          data: { clickCount: { increment: 1 } },
        })
      )
    );

    return sendSuccess(res, { offers }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/offers/:id - تفاصيل عرض معين
exports.getOfferById = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        offerProducts: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
                brand: true,
                ProductVariant: {
                  where: { isActive: true },
                  orderBy: { priceCents: "asc" },
                  take: 1,
                },
              },
            },
          },
        },
        offerCategories: {
          include: {
            category: true,
          },
        },
        offerBrands: {
          include: {
            brand: true,
          },
        },
      },
    });

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
    const txn = await prisma.$transaction(async (prisma) => {
      try {
      const {
        title,
        description,
        offerType,
        target,
        discountPercentage,
        discountAmount,
        minPurchaseAmount,
        maxDiscountAmount,
        startDate,
        endDate,
        displayOrder,
        productIds,
        categoryIds,
        brandIds,
      } = req.body;

      // 🔥 تحويل البيانات هنا في الباك إند
      const offerData = convertOfferData({
        title,
        description,
        offerType,
        target,
        discountPercentage,
        discountAmount,
        minPurchaseAmount,
        maxDiscountAmount,
        startDate,
        endDate,
        displayOrder: displayOrder || 0, // قيمة افتراضية
      });

      // الحصول على مسار الصورة إذا تم رفعها
      const image = req.file ? `/uploads/offers/${req.file.filename}` : null;

      // إنشاء العرض الأساسي
      const offer = await prisma.offer.create({
        data: {
          ...offerData,
          image,
        },
      });

      // إضافة المنتجات المحددة مع التحويل
      if (productIds && productIds.length > 0) {
        await prisma.offerProduct.createMany({
          data: productIds.map((productId) => ({
            offerId: offer.id,
            productId: parseInt(productId),
          })),
        });
      }

      // إضافة التصنيفات المحددة مع التحويل
      if (categoryIds && categoryIds.length > 0) {
        await prisma.offerCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            offerId: offer.id,
            categoryId: parseInt(categoryId),
          })),
        });
      }

      // إضافة الماركات المحددة مع التحويل
      if (brandIds && brandIds.length > 0) {
        await prisma.offerBrand.createMany({
          data: brandIds.map((brandId) => ({
            offerId: offer.id,
            brandId: parseInt(brandId),
          })),
        });
      }

      const fullOffer = await prisma.offer.findUnique({
        where: { id: offer.id },
        include: {
          offerProducts: { include: { product: true } },
          offerCategories: { include: { category: true } },
          offerBrands: { include: { brand: true } },
        },
      });

      return sendSuccess(
        res,
        {
          offer: fullOffer,
          message: "تم إنشاء العرض بنجاح",
        },
        201
      );
      } catch (error) {
        console.error("❌ Error in createOffer:", error);
        // إذا فشل الإنشاء، احذف الصورة المرفوعة
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        throw error;
      }
    });
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PUT /api/admin/offers/:id - تحديث عرض
exports.updateOffer = async (req, res) => {
  try {
    const txn = await prisma.$transaction(async (prisma) => {
      try {
      const offerId = parseInt(req.params.id);
      const updateData = req.body;

      // التحقق من وجود العرض
      const existingOffer = await prisma.offer.findUnique({
        where: { id: offerId },
      });

      if (!existingOffer) {
        // إذا فشل، احذف الصورة الجديدة المرفوعة
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return sendFail(res, { message: "العرض غير موجود" }, 404);
      }

      // إذا تم رفع صورة جديدة، أضف مسارها للبيانات
      if (req.file) {
        updateData.image = `/uploads/offers/${req.file.filename}`;

        // حذف الصورة القديمة إذا كانت موجودة
        if (existingOffer.image) {
          const oldImagePath = existingOffer.image.replace("/", "");
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }

      // إعداد بيانات التحديث
      const { productIds, categoryIds, brandIds, ...offerData } = updateData;

      // 🔥 تحويل البيانات هنا في الباك إند
      const convertedOfferData = convertOfferData(offerData);

      // displayOrder حقل مطلوب في النموذج - منع إرسال null صراحةً له
      if (convertedOfferData.displayOrder === null) {
        delete convertedOfferData.displayOrder;
      }

      // تحديث العرض الأساسي
      const updatedOffer = await prisma.offer.update({
        where: { id: offerId },
        data: convertedOfferData,
      });

      // تحديث العلاقات إذا تم إرسالها مع التحويل
      if (productIds) {
        await prisma.offerProduct.deleteMany({ where: { offerId } });
        if (productIds.length > 0) {
          await prisma.offerProduct.createMany({
            data: productIds.map((productId) => ({
              offerId,
              productId: parseInt(productId),
            })),
          });
        }
      }

      if (categoryIds) {
        await prisma.offerCategory.deleteMany({ where: { offerId } });
        if (categoryIds.length > 0) {
          await prisma.offerCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              offerId,
              categoryId: parseInt(categoryId),
            })),
          });
        }
      }

      if (brandIds) {
        await prisma.offerBrand.deleteMany({ where: { offerId } });
        if (brandIds.length > 0) {
          await prisma.offerBrand.createMany({
            data: brandIds.map((brandId) => ({
              offerId,
              brandId: parseInt(brandId),
            })),
          });
        }
      }

      const fullOffer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: {
          offerProducts: { include: { product: true } },
          offerCategories: { include: { category: true } },
          offerBrands: { include: { brand: true } },
        },
      });

      return sendSuccess(
        res,
        {
          offer: fullOffer,
          message: "تم تحديث العرض بنجاح",
        },
        200
      );
    } catch (error) {
      console.error("❌ Error in updateOffer:", error);
      // إذا فشل التحديث، احذف الصورة الجديدة المرفوعة
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
      }
    });
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/admin/offers - جميع العروض (للأدمن)
exports.getAllOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, q } = req.query;

    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (q && q.trim()) {
      const keyword = q.trim();
      where.OR = [
        { title: { contains: keyword } }, // ⬅️ بدون mode
        { description: { contains: keyword } }, // ⬅️ بدون mode
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const offers = await prisma.offer.findMany({
      where,
      include: {
        offerProducts: { include: { product: true } },
        offerCategories: { include: { category: true } },
        offerBrands: { include: { brand: true } },
        _count: {
          select: {
            offerProducts: true,
            offerCategories: true,
            offerBrands: true,
          },
        },
      },
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
    const txn = await prisma.$transaction(async (prisma) => {
      try {
      const offerId = parseInt(req.params.id);

      // التحقق من وجود العرض
      const offer = await prisma.offer.findUnique({
        where: { id: offerId },
      });

      if (!offer) {
        return sendFail(res, { message: "العرض غير موجود" }, 404);
      }

      // حذف الصورة إذا كانت موجودة
      if (offer.image) {
        const imagePath = offer.image.replace("/", "");
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // حذف العلاقات أولاً
      await prisma.offerProduct.deleteMany({ where: { offerId } });
      await prisma.offerCategory.deleteMany({ where: { offerId } });
      await prisma.offerBrand.deleteMany({ where: { offerId } });

      // ثم حذف العرض
      await prisma.offer.delete({
        where: { id: offerId },
      });

      return sendSuccess(
        res,
        {
          message: "تم حذف العرض بنجاح",
        },
        200
      );
    } catch (error) {
      throw error;
      }
    });
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/admin/offers/:id/toggle - تفعيل/تعطيل عرض
exports.toggleOffer = async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      return sendFail(res, { message: "العرض غير موجود" }, 404);
    }

    const updatedOffer = await prisma.offer.update({
      where: { id: offerId },
      data: { isActive: !offer.isActive },
    });

    return sendSuccess(
      res,
      {
        offer: updatedOffer,
        message: `تم ${updatedOffer.isActive ? "تفعيل" : "تعطيل"} العرض بنجاح`,
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};
