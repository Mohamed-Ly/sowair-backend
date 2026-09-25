const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const slugify = require("../utils/slugify");

// POST /api/brands
exports.createBrand = async (req, res) => {
  try {
    let { name, slug, country, isActive } = req.body;
    if (!slug || !slug.trim()) slug = slugify(name);

    // تحقق من uniqueness
    const byName = await prisma.brand.findUnique({ where: { name } });
    if (byName) return sendFail(res, { message: "اسم الماركة مستخدم بالفعل" }, 400);

    const bySlug = await prisma.brand.findUnique({ where: { slug } });
    if (bySlug) return sendFail(res, { message: "السلاق مستخدم بالفعل" }, 400);

    const brand = await prisma.brand.create({
      data: {
        name,
        slug,
        image: req.file
          ? `/uploads/${req.file.filename}`
          : typeof req.body.image === "string"
          ? req.body.image.trim() || null
          : null,
        country: country || null,
        isActive:
          isActive === undefined || isActive === null
            ? true
            : typeof isActive === "boolean"
            ? isActive
            : String(isActive).toLowerCase() === "true",
      },
    });

    return sendSuccess(res, { brand }, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/brands
// يدعم البحث + isActive + pagination + sort
exports.listBrands = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const isActiveParam = req.query.isActive;
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const sortBy = req.query.sortBy || "name";
    const order = (req.query.order || "asc").toLowerCase();

    const where = {};
    if (q) where.name = { contains: q };
    if (typeof isActiveParam !== "undefined") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const [total, brands] = await Promise.all([
      prisma.brand.count({ where }),
      prisma.brand.findMany({
        where,
        orderBy: [{ [sortBy]: order }],
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return sendSuccess(res, {
      total,
      page,
      pages: Math.ceil(total / limit),
      items: brands
    }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/brands/:id
exports.getBrand = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) return sendFail(res, { message: "الماركة غير موجودة" }, 404);
    return sendSuccess(res, { brand }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// PATCH /api/brands/:id
exports.updateBrand = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) return sendFail(res, { message: "الماركة غير موجودة" }, 404);

    let { name, slug, country, isActive } = req.body;

    // تحقق من الاسم إن تغيّر
    if (name && name !== existing.name) {
      const byName = await prisma.brand.findUnique({ where: { name } });
      if (byName && byName.id !== id) {
        return sendFail(res, { message: "اسم الماركة مستخدم بالفعل" }, 400);
      }
    }

    // slug
    if (slug && slug.trim()) {
      const s = slugify(slug);
      const bySlug = await prisma.brand.findUnique({ where: { slug: s } });
      if (bySlug && bySlug.id !== id) {
        return sendFail(res, { message: "السلاق مستخدم بالفعل" }, 400);
      }
      slug = s;
    } else if (name) {
      const s = slugify(name);
      const bySlug = await prisma.brand.findUnique({ where: { slug: s } });
      if (!bySlug || bySlug.id === id) slug = s;
    }

    const data = {
        name: name ?? existing.name,
        slug: slug ?? existing.slug,
        country:
          typeof country === "string" ? (country || null) : existing.country,
        isActive:
          typeof isActive === "boolean"
            ? isActive
            : typeof isActive === "string"
            ? String(isActive).toLowerCase() === "true"
            : existing.isActive,
      };
      if (req.file) {
        data.image = `/uploads/${req.file.filename}`;
      } else if (typeof req.body.image === "string") {
        data.image = req.body.image.trim() || null;
      }
      const updated = await prisma.brand.update({
      where: { id },
      data,
    });

    return sendSuccess(res, { brand: updated }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// DELETE /api/brands/:id
exports.deleteBrand = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // التحقق من وجود الماركة والمنتجات المرتبطة
    const existing = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: { take: 1 }, // نتحقق من وجود منتجات
        OfferBrand: { take: 1 } // والعلاقات مع العروض
      }
    });
    
    if (!existing) {
      return sendFail(res, { message: "الماركة غير موجودة" }, 404);
    }

    // 🔥 منع الحذف إذا كان هناك منتجات مرتبطة
    if (existing.products.length > 0) {
      return sendFail(res, { 
        message: "لا يمكن حذف الماركة لأنها تحتوي على منتجات. يرجى نقل المنتجات أولاً أو حذفها."
      }, 400);
    }

    // حذف العلاقات مع العروض أولاً
    await prisma.offerBrand.deleteMany({
      where: { brandId: id }
    });

    // ثم حذف الماركة
    await prisma.brand.delete({ where: { id } });
    
    return sendSuccess(res, { message: "تم حذف الماركة بنجاح" }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/brands/count
exports.countBrands = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const isActiveParam = req.query.isActive;

    const where = {};
    if (q) where.name = { contains: q };
    if (typeof isActiveParam !== "undefined") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const total = await prisma.brand.count({ where });
    return sendSuccess(res, { total }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
