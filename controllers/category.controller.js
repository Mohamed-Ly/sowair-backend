const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const slugify = require("../utils/slugify");

// POST /api/categories
exports.createCategory = async (req, res) => {
  try {
    let { name, slug, isActive, parentId } = req.body;
    if (!slug || !slug.trim()) slug = slugify(name);

    // slug فريد
    const conflict = await prisma.category.findUnique({ where: { slug } });
    if (conflict)
      return sendFail(res, { message: "السلاق مستخدم بالفعل" }, 400);

    // التحقق من تصنيف الأب إن وُجد
    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parseInt(parentId) },
      });
      if (!parent)
        return sendFail(res, { message: "التصنيف الأب غير موجود" }, 400);
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        image: req.file
          ? `/uploads/${req.file.filename}`
          : req.body.image && req.body.image.trim()
          ? req.body.image.trim()
          : null,
        isActive:
          isActive === undefined || isActive === null
            ? true
            : typeof isActive === "boolean"
            ? isActive
            : String(isActive).toLowerCase() === "true",
        parentId: parentId ? parseInt(parentId) : null,
      },
      include: { parent: true, children: { where: { isActive: true } } },
    });

    return sendSuccess(res, { category }, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/categories (قائمة كاملة، مع فلترة اختيارية بالاسم أو التصنيف الأب)
// parentId=null → تصنيفات جذرية فقط | parentId=رقم → أبناء تصنيف محدد
exports.listCategories = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const sortBy = req.query.sortBy || "name";
    const order = (req.query.order || "asc").toLowerCase();
    const parentIdParam = req.query.parentId;

    const where = {};
    if (q) where.name = { contains: q };
    if (parentIdParam && parentIdParam !== "null") {
      where.parentId = parseInt(parentIdParam);
    } else if (parentIdParam === "null") {
      where.parentId = null;
    }

    const [total, categories] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        include: { parent: true, _count: { select: { products: true } } },
        orderBy: [{ [sortBy]: order }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return sendSuccess(
      res,
      {
        total,
        page,
        pages: Math.ceil(total / limit),
        items: categories,
      },
      200
    );
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/categories/:id
exports.getCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: { orderBy: { name: "asc" } },
        products: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!category) return sendFail(res, { message: "التصنيف غير موجود" }, 404);
    return sendSuccess(res, { category }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/categories/count
exports.countCategories = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const isActiveParam = req.query.isActive; // اختياري: "true" | "false"

    const where = {};
    if (q) where.name = { contains: q };
    if (typeof isActiveParam !== "undefined") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const total = await prisma.category.count({ where });
    return sendSuccess(res, { total }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// PATCH /api/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return sendFail(res, { message: "التصنيف غير موجود" }, 404);

    let { name, slug, isActive, parentId } = req.body;

    // منع أن يكون التصنيف أباً لنفسه
    if (parentId) {
      const parentIdNum = parseInt(parentId);
      if (parentIdNum === id)
        return sendFail(res, { message: "لا يمكن أن يكون التصنيف أباً لنفسه" }, 400);
      const parent = await prisma.category.findUnique({
        where: { id: parentIdNum },
      });
      if (!parent)
        return sendFail(res, { message: "التصنيف الأب غير موجود" }, 400);
    }

    if (slug && slug.trim()) {
      // تأكد عدم وجود تعارض
      const s = slugify(slug);
      const conflict = await prisma.category.findUnique({ where: { slug: s } });
      if (conflict && conflict.id !== id) {
        return sendFail(res, { message: "السلاق مستخدم بالفعل" }, 400);
      }
      slug = s;
    } else if (name) {
      const s = slugify(name);
      const conflict = await prisma.category.findUnique({ where: { slug: s } });
      if (!conflict || conflict.id === id) slug = s; // حدّثه لو لا يوجد تعارض
    }

    const data = {
        name: name ?? existing.name,
        slug: slug ?? existing.slug,
        isActive:
          typeof isActive === "boolean"
            ? isActive
            : typeof isActive === "string"
            ? String(isActive).toLowerCase() === "true"
            : existing.isActive,
        parentId:
          typeof parentId !== "undefined" && parentId !== null && parentId !== ""
            ? parseInt(parentId)
            : existing.parentId,
      };
      if (req.file) {
        data.image = `/uploads/${req.file.filename}`;
      } else if (typeof req.body.image === "string") {
        data.image = req.body.image.trim() || null;
      }
      const updated = await prisma.category.update({
      where: { id },
      data,
      include: { parent: true, children: true },
    });

    return sendSuccess(res, { category: updated }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// DELETE /api/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);

    // التحقق من وجود التصنيف والمنتجات المرتبطة
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        products: { take: 1 }, // نتحقق من وجود منتجات
        ProductCategory: { take: 1 }, // والعلاقات المتعددة
        _count: { select: { children: true } },
      },
    });

    if (!existing) {
      return sendFail(res, { message: "التصنيف غير موجود" }, 404);
    }

    // 🔥 منع الحذف إذا كان هناك تصنيفات فرعية
    if (existing._count.children > 0) {
      return sendFail(
        res,
        { message: "لا يمكن حذف التصنيف لأنه يحتوي على تصنيفات فرعية." },
        400
      );
    }

    // 🔥 منع الحذف إذا كان هناك منتجات مرتبطة
    if (existing.products.length > 0 || existing.ProductCategory.length > 0) {
      return sendFail(
        res,
        {
          message:
            "لا يمكن حذف التصنيف لأنه يحتوي على منتجات. يرجى نقل المنتجات أولاً أو حذفها.",
        },
        400
      );
    }

    // حذف العلاقات مع العروض أولاً
    await prisma.offerCategory.deleteMany({
      where: { categoryId: id },
    });

    // ثم حذف التصنيف
    await prisma.category.delete({ where: { id } });

    return sendSuccess(res, { message: "تم حذف التصنيف بنجاح" }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
