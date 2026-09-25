const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");

// helper للتأكد من وجود المنتج
async function ensureProduct(productId) {
  return prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
}

// إنشاء Variant لمنتج
exports.createVariant = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = await ensureProduct(productId);
    if (!product) return sendFail(res, { message: "المنتج غير موجود" }, 404);

    const { option1, option2, priceCents, stockQty, sku, barcode, isActive } = req.body;

    // منع تكرار نفس (الخيارين) لنفس المنتج
    if (option1 || option2) {
      const dup = await prisma.productVariant.findFirst({
        where: { productId, option1: option1 || null, option2: option2 || null }
      });
      if (dup) return sendFail(res, { message: "متغير بهذه (الخيارات) موجود مسبقًا" }, 400);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        option1: option1 || null,
        option2: option2 || null,
        priceCents: Number(priceCents),
        stockQty: stockQty ? Number(stockQty) : 0,
        sku: sku || null,
        barcode: barcode || null,
        isActive: typeof isActive === "boolean" ? isActive : (typeof isActive === "string" ? isActive === "true" : true),
      }
    });

    return sendSuccess(res, { variant }, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// لائحة Variants لمنتج
exports.listVariants = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = await ensureProduct(productId);
    if (!product) return sendFail(res, { message: "المنتج غير موجود" }, 404);

    const isActiveParam = req.query.isActive;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const sortBy = req.query.sortBy || "createdAt";
    const order = (req.query.order || "desc").toLowerCase();

    const where = { productId };
    if (typeof isActiveParam !== "undefined") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const [total, items] = await Promise.all([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        orderBy: [{ [sortBy]: order }],
        skip: (page - 1) * limit,
        take: limit,
      })
    ]);

    return sendSuccess(res, {
      total,
      page,
      pages: Math.ceil(total / limit),
      items
    }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// تفاصيل Variant
exports.getVariant = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId }
    });
    if (!variant) return sendFail(res, { message: "المتغير غير موجود" }, 404);

    return sendSuccess(res, { variant }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// تحديث Variant
exports.updateVariant = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId }
    });
    if (!existing) return sendFail(res, { message: "المتغير غير موجود" }, 404);

    let { option1, option2, priceCents, stockQty, sku, barcode, isActive } = req.body;

    // التحقق من عدم تكرار (option1 + option2) لنفس المنتج عند التعديل
    if (typeof option1 !== "undefined" || typeof option2 !== "undefined") {
      const newOpt1 = typeof option1 !== "undefined" ? (option1 === null || option1 === "" ? null : String(option1)) : existing.option1;
      const newOpt2 = typeof option2 !== "undefined" ? (option2 === null || option2 === "" ? null : String(option2)) : existing.option2;

      const dup = await prisma.productVariant.findFirst({
        where: {
          productId,
          option1: newOpt1,
          option2: newOpt2,
          NOT: { id: variantId }
        }
      });
      if (dup) return sendFail(res, { message: "متغير بهذه (الخيارات) موجود مسبقًا" }, 400);

      option1 = newOpt1;
      option2 = newOpt2;
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        option1: typeof option1 !== "undefined" ? (option1 === null || option1 === "" ? null : String(option1)) : existing.option1,
        option2: typeof option2 !== "undefined" ? (option2 === null || option2 === "" ? null : String(option2)) : existing.option2,
        priceCents: typeof priceCents !== "undefined" ? Number(priceCents) : existing.priceCents,
        stockQty: typeof stockQty !== "undefined" ? Number(stockQty) : existing.stockQty,
        sku: typeof sku !== "undefined" ? (sku || null) : existing.sku,
        barcode: typeof barcode !== "undefined" ? (barcode || null) : existing.barcode,
        isActive: typeof isActive === "boolean"
          ? isActive
          : (typeof isActive === "string" ? (isActive.toLowerCase() === "true" ? true : isActive.toLowerCase() === "false" ? false : existing.isActive) : existing.isActive),
      }
    });

    return sendSuccess(res, { variant: updated }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// حذف Variant
exports.deleteVariant = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId }
    });
    if (!existing) return sendFail(res, { message: "المتغير غير موجود" }, 404);

    await prisma.productVariant.delete({ where: { id: variantId } });
    return sendSuccess(res, { message: "تم حذف المتغير بنجاح" }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// عدّاد Variants لمنتج
exports.countVariants = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = await ensureProduct(productId);
    if (!product) return sendFail(res, { message: "المنتج غير موجود" }, 404);

    const isActiveParam = req.query.isActive;
    const where = { productId };
    if (typeof isActiveParam !== "undefined") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const total = await prisma.productVariant.count({ where });
    return sendSuccess(res, { total }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// تعديل المخزون (زيادة/نقصان)
exports.adjustStock = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const variantId = Number(req.params.variantId);
    const delta = Number(req.body.delta);

    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId }
    });
    if (!existing) return sendFail(res, { message: "المتغير غير موجود" }, 404);

    const newQty = existing.stockQty + delta;
    if (newQty < 0) return sendFail(res, { message: "المخزون لا يمكن أن يكون سالبًا" }, 400);

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQty: newQty }
    });

    return sendSuccess(res, { variant: updated }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
