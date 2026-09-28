const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");

// ========================== ADMIN ==========================

// GET /api/admin/suppliers?q=&isActive=&page=&limit=&sortBy=&order=
exports.listSuppliers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || "10", 10), 100));
    const sortBy = ["name", "createdAt"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "name";
    const order = (req.query.order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    const isActiveParam = req.query.isActive;

    const where = {};
    if (q) where.name = { contains: q };
    if (typeof isActiveParam !== "undefined" && isActiveParam !== "") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        include: { _count: { select: { variants: true } } },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return sendSuccess(
      res,
      { total, page, pages: Math.ceil(total / limit), items: suppliers },
      200
    );
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/admin/suppliers/:id
exports.getSupplier = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        variants: {
          select: {
            id: true,
            option1: true,
            option2: true,
            priceCents: true,
            costCents: true,
            stockQty: true,
            isActive: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!supplier) return sendFail(res, { message: "المورد غير موجود" }, 404);
    return sendSuccess(res, { supplier }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// POST /api/admin/suppliers
exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, notes, isActive } = req.body;

    const byName = await prisma.supplier.findFirst({ where: { name } });
    if (byName) return sendFail(res, { message: "اسم المورد مستخدم بالفعل" }, 400);

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        isActive:
          isActive === undefined || isActive === null
            ? true
            : typeof isActive === "boolean"
            ? isActive
            : String(isActive).toLowerCase() === "true",
      },
    });

    return sendSuccess(res, { supplier }, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// PATCH /api/admin/suppliers/:id
exports.updateSupplier = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return sendFail(res, { message: "المورد غير موجود" }, 404);

    const { name, phone, email, address, notes, isActive } = req.body;

    if (name && name !== existing.name) {
      const byName = await prisma.supplier.findFirst({ where: { name } });
      if (byName && byName.id !== id) {
        return sendFail(res, { message: "اسم المورد مستخدم بالفعل" }, 400);
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        phone: typeof phone === "string" ? phone || null : existing.phone,
        email: typeof email === "string" ? email || null : existing.email,
        address: typeof address === "string" ? address || null : existing.address,
        notes: typeof notes === "string" ? notes || null : existing.notes,
        isActive:
          typeof isActive === "boolean"
            ? isActive
            : typeof isActive === "string"
            ? String(isActive).toLowerCase() === "true"
            : existing.isActive,
      },
    });

    return sendSuccess(res, { supplier: updated }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// DELETE /api/admin/suppliers/:id
exports.deleteSupplier = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!existing) return sendFail(res, { message: "المورد غير موجود" }, 404);

    //Variant ما بترجعش ل沒有 مورد — فقط تفصل
    if (existing._count.variants > 0) {
      return sendFail(
        res,
        {
          message: `لا يمكن حذف المورد لأن ${existing._count.variants} منتج مرتبط بيه. أوقفه بدلاً من حذفه.`,
        },
        400
      );
    }

    await prisma.supplier.delete({ where: { id } });
    return sendSuccess(res, { message: "تم حذف المورد بنجاح" }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/admin/suppliers/count
exports.countSuppliers = async (req, res) => {
  try {
    const where = {};
    if (req.query.isActive !== undefined && req.query.isActive !== "") {
      where.isActive = String(req.query.isActive).toLowerCase() === "true";
    }
    const total = await prisma.supplier.count({ where });
    return sendSuccess(res, { total }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
