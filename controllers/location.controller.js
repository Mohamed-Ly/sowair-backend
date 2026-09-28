const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");

// ملاحظة: isActive بيتحقق منه بـ .isBoolean() في updateCityValidation /
// updateAreaValidation، فاللي بيوصل هنا已是 boolean حقيقي.
// مصدر إصلاح الـ toggle هو الواجهة (checkbox بيبعت checked مش value).

// ========================== ADMIN ==========================

// GET /api/admin/locations/cities?q=&isActive=&page=&limit=
exports.listCities = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = parseInt(req.query.page || "1", 10);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || "50", 10), 200));
    const isActiveParam = req.query.isActive;

    const where = {};
    if (q) where.name = { contains: q };
    if (typeof isActiveParam !== "undefined" && isActiveParam !== "") {
      where.isActive = String(isActiveParam).toLowerCase() === "true";
    }

    const [total, cities] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where,
        include: {
          areas: {
            orderBy: { sortOrder: "asc" },
            include: { _count: { select: { orders: true } } },
          },
          _count: { select: { areas: true, orders: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return sendSuccess(res, { total, page, pages: Math.ceil(total / limit), items: cities }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/admin/locations/cities/:id
exports.getCity = async (req, res) => {
  try {
    const city = await prisma.city.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        areas: { orderBy: { sortOrder: "asc" } },
        _count: { select: { orders: true } },
      },
    });
    if (!city) return sendFail(res, "المدينة غير موجودة", 404);
    return sendSuccess(res, city, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// POST /api/admin/locations/cities
exports.createCity = async (req, res) => {
  try {
    const { name, code, deliveryFeeCents, isActive, sortOrder } = req.body;
    // الـ validator بيقصّ المسافات، بس بنقصّها هنا برضو عشان نتأكد
    const cleanName = String(name).trim();

    const exists = await prisma.city.findFirst({ where: { name: cleanName } });
    if (exists) return sendFail(res, "يوجد مدينة بنفس الاسم", 400);

    const city = await prisma.city.create({
      data: {
        name: cleanName,
        code: code?.trim() || null,
        deliveryFeeCents: deliveryFeeCents ?? 0,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });
    return sendSuccess(res, city, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// PATCH /api/admin/locations/cities/:id
exports.updateCity = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.city.findUnique({ where: { id } });
    if (!existing) return sendFail(res, "المدينة غير موجودة", 404);

    const { name, code, deliveryFeeCents, isActive, sortOrder } = req.body;
    const cleanName = name !== undefined ? String(name).trim() : undefined;
    if (cleanName && cleanName !== existing.name) {
      const dup = await prisma.city.findFirst({
        where: { name: cleanName, id: { not: id } },
      });
      if (dup) return sendFail(res, "يوجد مدينة بنفس الاسم", 400);
    }

    const city = await prisma.city.update({
      where: { id },
      data: {
        ...(cleanName !== undefined ? { name: cleanName } : {}),
        ...(code !== undefined ? { code: code?.trim() || null } : {}),
        ...(deliveryFeeCents !== undefined ? { deliveryFeeCents } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    return sendSuccess(res, city, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// DELETE /api/admin/locations/cities/:id
// ⚠️ حذف المدينة بيمسح مناطقها (Cascade) ويفصلها من الطلبات القديمة (SetNull).
// snapshot على الطلب (deliveryCityName) بيفضل موجود للطلبات القديمة.
exports.deleteCity = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const city = await prisma.city.findUnique({
      where: { id },
      include: { _count: { select: { orders: true, areas: true } } },
    });
    if (!city) return sendFail(res, "المدينة غير موجودة", 404);

    if (city._count.orders > 0) {
      return sendFail(
        res,
        `ما ينفعش تحذف المدينة ديالها فيها ${city._count.orders} طلب. غيّرها لـ"غير مفعّلة" بدل الحذف.`,
        400
      );
    }

    await prisma.city.delete({ where: { id } });
    return sendSuccess(res, { id, deletedAreas: city._count.areas }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/admin/locations/areas?cityId=
exports.listAreas = async (req, res) => {
  try {
    const where = {};
    if (req.query.cityId) where.cityId = Number(req.query.cityId);
    if (typeof req.query.isActive !== "undefined" && req.query.isActive !== "") {
      where.isActive = String(req.query.isActive).toLowerCase() === "true";
    }

    const areas = await prisma.area.findMany({
      where,
      include: {
        city: { select: { id: true, name: true, deliveryFeeCents: true } },
        _count: { select: { orders: true } },
      },
      orderBy: [{ cityId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return sendSuccess(res, { total: areas.length, items: areas }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// POST /api/admin/locations/areas
exports.createArea = async (req, res) => {
  try {
    const { name, cityId, deliveryFeeCents, isActive, sortOrder } = req.body;

    const city = await prisma.city.findUnique({ where: { id: Number(cityId) } });
    if (!city) return sendFail(res, "المدينة غير موجودة", 400);

    const dup = await prisma.area.findUnique({
      where: { cityId_name: { cityId: Number(cityId), name: name.trim() } },
    });
    if (dup) return sendFail(res, "في منطقة بنفس الاسم في المدينة ديالها", 400);

    const area = await prisma.area.create({
      data: {
        name: name.trim(),
        cityId: Number(cityId),
        deliveryFeeCents: deliveryFeeCents ?? null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });
    return sendSuccess(res, area, 201);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// PATCH /api/admin/locations/areas/:id
exports.updateArea = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) return sendFail(res, "المنطقة غير موجودة", 404);

    const { name, cityId, deliveryFeeCents, isActive, sortOrder } = req.body;
    const nextCityId = cityId !== undefined ? Number(cityId) : existing.cityId;
    const nextName = name !== undefined ? name.trim() : existing.name;

    if (nextCityId !== existing.cityId || nextName !== existing.name) {
      const dup = await prisma.area.findUnique({
        where: { cityId_name: { cityId: nextCityId, name: nextName } },
      });
      if (dup && dup.id !== id) return sendFail(res, "في منطقة بنفس الاسم في المدينة ديالها", 400);
    }

    if (cityId !== undefined) {
      const city = await prisma.city.findUnique({ where: { id: nextCityId } });
      if (!city) return sendFail(res, "المدينة غير موجودة", 400);
    }

    const area = await prisma.area.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: nextName } : {}),
        ...(cityId !== undefined ? { cityId: nextCityId } : {}),
        ...(deliveryFeeCents !== undefined ? { deliveryFeeCents } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });
    return sendSuccess(res, area, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// DELETE /api/admin/locations/areas/:id
exports.deleteArea = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const area = await prisma.area.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!area) return sendFail(res, "المنطقة غير موجودة", 404);

    if (area._count.orders > 0) {
      return sendFail(
        res,
        `ما ينفعش تحذف المنطقة ديالها فيها ${area._count.orders} طلب. غيّرها لـ"غير مفعّلة" بدل الحذف.`,
        400
      );
    }

    await prisma.area.delete({ where: { id } });
    return sendSuccess(res, { id }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// ========================== PUBLIC ==========================
// endpoints ديال الـ checkout — ما كايتطلبوش توكن.
// كيديرو active غير، باش ما نوريش للعميل مدينة موقوفة.

// GET /api/locations/cities
exports.publicCities = async (req, res) => {
  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        deliveryFeeCents: true,
        areas: {
          where: { isActive: true },
          select: { id: true, name: true, deliveryFeeCents: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return sendSuccess(res, { total: cities.length, items: cities }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// GET /api/locations/cities/:id/areas
exports.publicAreas = async (req, res) => {
  try {
    const cityId = Number(req.params.id);
    const city = await prisma.city.findFirst({ where: { id: cityId, isActive: true } });
    if (!city) return sendFail(res, "المدينة غير متاحة", 404);

    const areas = await prisma.area.findMany({
      where: { cityId, isActive: true },
      select: { id: true, name: true, deliveryFeeCents: true },
      orderBy: { sortOrder: "asc" },
    });
    return sendSuccess(res, { city: { id: city.id, name: city.name }, total: areas.length, items: areas }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// POST /api/locations/fee  — يحسب رسوم التوصيل للمنطقة المختارة
// الاستعمال: العميل يختار المنطقة ويعرف السعر قبل ما يأكد الطلب
exports.quoteFee = async (req, res) => {
  try {
    const areaId = Number(req.body?.areaId);
    if (!Number.isInteger(areaId) || areaId <= 0) return sendFail(res, "المنطقة غير صالحة", 400);

    const area = await prisma.area.findFirst({
      where: { id: areaId, isActive: true },
      include: { city: true },
    });
    if (!area || !area.city.isActive) return sendFail(res, "المنطقة غير متاحة", 404);

    // رسوم المنطقة لها الأولوية، وإلا رسوم المدينة
    const feeCents = area.deliveryFeeCents ?? area.city.deliveryFeeCents;
    return sendSuccess(
      res,
      {
        cityId: area.cityId,
        cityName: area.city.name,
        areaId: area.id,
        areaName: area.name,
        deliveryFeeCents: feeCents,
        // flag بيوحّد للعميل: هل السعر جاي من المنطقة ولا من المدينة
        isAreaOverride: area.deliveryFeeCents !== null,
      },
      200
    );
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
