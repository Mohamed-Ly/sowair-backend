const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError, businessError, isBusinessError } = require("../utils/responseHelper");
const { sendUserNotification } = require("../services/notification.service");
const { priceCartItems } = require("../services/pricing.service");
const {
  mapStatusToNotificationType,
  buildOrderStatusMessage,
} = require("../services/order-notification.templates");
const { canTransition } = require("../services/order-status.service");

// دالة مساعدة لإنشاء رقم طلب فريد
function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD-${timestamp}${random}`;
}

// ========================== routes for USER ==========================
// POST /api/orders - إنشاء طلب جديد
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { shippingName, shippingPhone, shippingAddress, deliveryCityId, deliveryAreaId } = req.body;

    // نفّذ كل خطوات الإنشاء داخل Transaction وارجع الـ order
    const order = await prisma.$transaction(async (tx) => {
      // 0) المدينة/المنطقة: بنتحقق إن المنطقة تابعة لل city's فعلاً،
      // وبنخزّن الاسم مع الـ ID (snapshot) عشان الطلب القديم يفضل مقروء
      // حتى لو الأدمن غيّر الاسم أو حذف المنطقة.
      let cityName = null;
      let areaName = null;
      let effectiveCityId = deliveryCityId ?? null;
      let feeCents = 0;
      if (deliveryAreaId || deliveryCityId) {
        const area = deliveryAreaId
          ? await tx.area.findUnique({ where: { id: deliveryAreaId } })
          : null;
        if (deliveryAreaId && !area) businessError("المنطقة المختارة غير موجودة");
        if (area && deliveryCityId && area.cityId !== deliveryCityId) {
          businessError("المنطقة المختارة لا تتبع المدينة المختارة");
        }
        const city = area
          ? await tx.city.findUnique({ where: { id: area.cityId } })
          : await tx.city.findUnique({ where: { id: deliveryCityId } });
        if (deliveryCityId && !city) businessError("المدينة المختارة غير موجودة");
        if (city && !city.isActive) businessError("التوصيل دلوقتي غير متاح للمدينة ديالك");
        if (area && !area.isActive) businessError("المنطقة ديالك غير متاحة دلوقتي");
        cityName = city?.name ?? null;
        areaName = area?.name ?? null;
        // لو العميل بعت المنطقة بوحدها، المدينة بتتستنتج منها
        if (area && !effectiveCityId) effectiveCityId = area.cityId;
        // رسوم التوصيل base = رسوم المنطقة (إن وجدت) وإلا رسوم المدينة.
        // Snapshot على الطلب عشان محفظة المندوب تظل صحيحة حتى لو اتغير السعر لاحقاً.
        feeCents = area
          ? (area.deliveryFeeCents ?? city.deliveryFeeCents)
          : city
            ? city.deliveryFeeCents
            : 0;
      }
      // 1) جلب السلة
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        // انتبه: لا ترجع Response من داخل الترانزكشن
        businessError("السلة فارغة");
      }

      // 2) التحقق من التوفر والمخزون
      for (const item of cart.items) {
        if (!item.variant.isActive || !item.variant.product.isActive) {
          businessError(`المنتج ${item.variant.product.name} غير متاح حالياً`);
        }
        if (item.variant.stockQty < item.qty) {
          businessError(`الكمية المطلوبة من ${item.variant.product.name} تتجاوز المخزون المتاح`);
        }
      }

      // 3) حساب الإجمالي مع تطبيق العروض وبناء عناصر الطلب
      const pricing = await priceCartItems(
        tx,
        cart.items.map((item) => ({
          variantId: item.variant.id,
          qty: item.qty,
          unitPriceCents: item.variant.priceCents,
          productId: item.variant.product.id,
          categoryId: item.variant.product.categoryId,
          brandId: item.variant.product.brandId,
        }))
      );

      const orderItemsData = pricing.lines.map((l) => {
        const v = cart.items.find((i) => i.variant.id === l.variantId).variant;
        return {
          variantId: l.variantId,
          unitPriceCents: l.unitPriceCents,
          qty: l.qty,
          discountCents: l.discountCents,
          lineTotalCents: l.lineTotalCents,
          // نسخة ثابتة من سعر الشراء وقت الطلب — عشان تغيير سعر الشراء بكرة
          // ما يغيّرش أرباح الطلبات القديمة. null = كان مجهول.
          unitCostCents: v.costCents ?? null,
        };
      });

      // 4) إنشاء الطلب
      const created = await tx.order.create({
        data: {
          userId,
          totalCents: pricing.totalCents,
          subtotalCents: pricing.subtotalCents,
          discountCents: pricing.discountCents,
          shippingName,
          shippingPhone,
          shippingAddress,
          deliveryCityId: effectiveCityId,
          deliveryAreaId: deliveryAreaId ?? null,
          deliveryCityName: cityName,
          deliveryAreaName: areaName,
          deliveryFeeCents: feeCents,
          orderNumber: generateOrderNumber(),
          cancelDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 ساعة
          items: { create: orderItemsData },
        },
        include: {
          deliveryCity: { select: { id: true, name: true, code: true } },
          deliveryArea: { select: { id: true, name: true } },
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      images: { where: { isPrimary: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // 5) تفريغ السلة
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      // 6) تسجيل حركة الحالة الأولية
      await tx.orderStatusLog.create({
        data: {
          orderId: created.id,
          status: "PENDING",
          actorType: "SYSTEM",
          note: "تم إنشاء الطلب",
        },
      });

      return created; // نُعيد الطلب فقط
    });

    // ===== بعد نجاح الترانزكشن: أرسل إشعار "PENDING" =====
    try {
      const { title, body } = buildOrderStatusMessage({
        status: "PENDING",
        orderNumber: order.orderNumber,
      });

      await sendUserNotification({
        userId,
        type: "ORDER_CREATED",
        title,
        body,
        data: { orderId: String(order.id), orderNumber: order.orderNumber },
      });
    } catch (e) {
      console.error("Failed to send pending order notification:", e.message);
    }

    // Response النهائي
    return sendSuccess(
      res,
      { order, message: "تم إنشاء الطلب بنجاح وسيتم التواصل معك لتأكيد الطلب" },
      201
    );
  } catch (error) {
    // أخطاء التحقق اللي جوّه الـ transaction (سلة فاضية، مخزون ناقص،
    // مدينة/منطقة غير صالحة) = 400 مش 500
    if (isBusinessError(error)) {
      return sendFail(res, { message: error.message }, error.statusCode || 400);
    }
    return sendError(res, error.message, 500);
  }
};

// GET /api/orders - قائمة طلبات المستخدم
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { page = 1, limit = 10 } = req.query;

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        deliveryCity: { select: { id: true, name: true, code: true } },
        deliveryArea: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    const total = await prisma.order.count({ where: { userId } });

    return sendSuccess(
      res,
      {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/orders/:id - تفاصيل طلب معين
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.sub;
    const orderId = parseInt(req.params.id);

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        deliveryCity: { select: { id: true, name: true, code: true } },
        deliveryArea: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }

    return sendSuccess(res, { order }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PUT /api/orders/:id - تحديث بيانات الطلب من قبل المستخدم
exports.updateOrder = async (req, res) => {
  try {
    const userId = req.user.sub;
    const orderId = parseInt(req.params.id);
    const { shippingName, shippingPhone, shippingAddress } = req.body;

    // البحث عن الطلب والتأكد أنه للمستخدم
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }

    // التحقق من الوقت (24 ساعة فقط) - نفس شرط الإلغاء
    if (order.cancelDeadline && new Date() > order.cancelDeadline) {
      return sendFail(
        res,
        {
          message: "لا يمكن تعديل الطلب بعد مرور 24 ساعة من إنشائه",
        },
        400
      );
    }

    // التحقق من الحالة - يسمح بالتعديل فقط إذا كان قيد المراجعة
    if (order.status !== "PENDING") {
      return sendFail(
        res,
        {
          message: "لا يمكن تعديل الطلب بعد تأكيده",
        },
        400
      );
    }

    // بناء بيانات التحديث
    const updateData = {};
    if (shippingName) updateData.shippingName = shippingName;
    if (shippingPhone) updateData.shippingPhone = shippingPhone;
    if (shippingAddress) updateData.shippingAddress = shippingAddress;

    // تغيير المنطقة/المدينة: نتحقق ونحدّث الـ snapshot مع بعض.
    // لو بعت المنطقة بوحدها، المدينة بتتستنتج منها (نفس اللي في createOrder).
    if (req.body.deliveryCityId !== undefined || req.body.deliveryAreaId !== undefined) {
      const clean = (v) =>
        v === null || v === undefined || v === "" ? null : Number(v);
      const nextCityId = clean(req.body.deliveryCityId);
      const nextAreaId = clean(req.body.deliveryAreaId);

      let cityName = null;
      let areaName = null;
      const area = nextAreaId ? await prisma.area.findUnique({ where: { id: nextAreaId } }) : null;
      if (nextAreaId && !area) {
        return sendFail(res, { message: "المنطقة المختارة غير موجودة" }, 400);
      }
      if (area && nextCityId && area.cityId !== nextCityId) {
        return sendFail(res, { message: "المنطقة المختارة لا تتبع المدينة المختارة" }, 400);
      }
      // المنطقة موجودة والمدينة مش مرسلة = نستنتج المدينة من المنطقة
      const effectiveCityId = area ? area.cityId : nextCityId;
      const city = effectiveCityId
        ? await prisma.city.findUnique({ where: { id: effectiveCityId } })
        : null;
      if (effectiveCityId && !city) {
        return sendFail(res, { message: "المدينة المختارة غير موجودة" }, 400);
      }
      cityName = city?.name ?? null;
      areaName = area?.name ?? null;
      updateData.deliveryCityId = effectiveCityId;
      updateData.deliveryAreaId = nextAreaId;
      updateData.deliveryCityName = cityName;
      updateData.deliveryAreaName = areaName;
    }

    // إذا لم يتم إرسال أي بيانات للتحديث
    if (Object.keys(updateData).length === 0) {
      return sendFail(
        res,
        {
          message: "لم يتم إرسال أي بيانات للتحديث",
        },
        400
      );
    }

    // تحديث الطلب
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        deliveryCity: { select: { id: true, name: true, code: true } },
        deliveryArea: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    });

    return sendSuccess(
      res,
      {
        order: updatedOrder,
        message: "تم تحديث بيانات الطلب بنجاح",
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// POST /api/orders/:id/cancel - إلغاء الطلب من قبل المستخدم
exports.cancelOrderByUser = async (req, res) => {
  try {
    const userId = req.user.sub;
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    // نرجّع البيانات من داخل الترانزكشن ونرسل الرد بعد نجاحها
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true },
      });

      if (!order) throw new Error("NOT_FOUND");

      // التحقق من الوقت (24 ساعة فقط)
      if (order.cancelDeadline && new Date() > order.cancelDeadline) {
        throw new Error("DEADLINE_PASSED");
      }

      // التحقق من الحالة
      if (order.status !== "PENDING") {
        throw new Error("ALREADY_CONFIRMED");
      }

      // إرجاع المخزون فقط إذا كان قد خُصم فعلاً (الخصم يتم عند CONFIRMED)
      // المسار هنا PENDING فقط فلازم stockDeducted=false، بس نحسب
      // qty - returnedQty احتياطاً باش لو تغيّر الشرط ما يبقاش فيه تسريب مخزون.
      if (order.stockDeducted) {
        await Promise.all(
          order.items.map((item) => {
            const toRestock = Math.max(0, item.qty - item.returnedQty);
            if (toRestock === 0) return Promise.resolve();
            return tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQty: { increment: toRestock } },
            });
          })
        );
      }

      // تحديث الطلب
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledReason: reason || "ألغاه المستخدم",
          cancelledByUser: true,
          stockDeducted: false,
        },
      });

      // تسجيل حركة الإلغاء
      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: "CANCELLED",
          actorType: "CUSTOMER",
          actorId: userId,
          note: reason || "ألغاه المستخدم",
        },
      });

      return updated;
    });

    // ===== بعد نجاح الترانزكشن: أرسل إشعار الإلغاء =====
    try {
      const { title, body } = buildOrderStatusMessage({
        status: "CANCELLED",
        orderNumber: updatedOrder.orderNumber,
      });
      await sendUserNotification({
        userId,
        type: "ORDER_CANCELLED",
        title,
        body,
        data: {
          orderId: String(orderId),
          orderNumber: updatedOrder.orderNumber,
        },
      });
    } catch (e) {
      console.error("Failed to send cancel notification:", e.message);
    }

    return sendSuccess(
      res,
      {
        order: updatedOrder,
        message: "تم إلغاء الطلب بنجاح",
      },
      200
    );
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }
    if (error.message === "DEADLINE_PASSED") {
      return sendFail(
        res,
        { message: "لا يمكن إلغاء الطلب بعد مرور 24 ساعة من إنشائه" },
        400
      );
    }
    if (error.message === "ALREADY_CONFIRMED") {
      return sendFail(
        res,
        { message: "لا يمكن إلغاء الطلب بعد تأكيده" },
        400
      );
    }
    return sendError(res, error.message, 500);
  }
};

// ========================== routes for ADMIN ==========================
exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      search,
      deliveryCityId,
      deliveryAreaId,
    } = req.query;

    // بناء where clause للتصفية
    const where = {};

    if (status) where.status = status;
    if (deliveryCityId) where.deliveryCityId = Number(deliveryCityId);
    if (deliveryAreaId) where.deliveryAreaId = Number(deliveryAreaId);
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { shippingName: { contains: search } },
        { shippingPhone: { contains: search } },
        { shippingAddress: { contains: search } },
        // الأدمن يقدر يدوّر باسم المدينة/المنطقة مباشرة
        { deliveryCityName: { contains: search } },
        { deliveryAreaName: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        deliveryCity: { select: { id: true, name: true, code: true } },
        deliveryArea: { select: { id: true, name: true } },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    });

    const total = await prisma.order.count({ where });

    return sendSuccess(
      res,
      {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/admin/orders/stats - إحصائيات الطلبات
exports.getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // إجمالي الطلبات
    const totalOrders = await prisma.order.count({ where });

    // الطلبات حسب الحالة
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      where,
    });

    // إجمالي المبيعات
    const revenueResult = await prisma.order.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { totalCents: true },
      _count: { id: true },
    });

    // طلبات اليوم
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayOrders = await prisma.order.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const stats = {
      totalOrders,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      totalRevenue: revenueResult._sum.totalCents || 0,
      averageOrderValue: revenueResult._count.id
        ? revenueResult._sum.totalCents / revenueResult._count.id
        : 0,
      todayOrders,
    };

    return sendSuccess(res, { stats }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/admin/orders/:id - تفاصيل طلب كاملة (للأدمن)
exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    brand: true,
                    category: true,
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }

    return sendSuccess(res, { order }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/orders/:id/status - تحديث حالة الطلب (للأدمن)
exports.updateOrderStatus = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, cancelledReason } = req.body;

    // نفّذ المنطق داخل Transaction وأعد الـ updatedOrder
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { variant: true } } },
      });

      if (!order) {
        throw new Error("NOT_FOUND");
      }

      // Phase 4: الحالات النهائية ما يمكنش تتحدد من هنا — ليها طريقتها
      // المخصوصة (settle endpoint) لأنها محتاجة الكميات المسلّمة والفلوس
      // المقبوضة. لو سمحنا للأدمن يعملها، order.collectedCents يفضل 0
      // والـ per-item quantities تضل 0 = بيانات كاذبة.
      // ملاحظة: الخريطة في order-status.service.js لسه فيها DELIVERED من
      // SHIPPING لأنها حقيقة نطاق (settle بيستخدمها) — التقييد هنا في
      // الأدمن بس.
      if (status === "PARTIALLY_DELIVERED" || status === "DELIVERED") {
        throw new Error("DELIVERY_REQUIRES_SETTLE");
      }

      const transition = canTransition(order.status, status);
      if (!transition.ok) {
        throw new Error(`INVALID_TRANSITION:${transition.reason}`);
      }

      const updateData = { status };

      // عند الإلغاء: سجّل السبب والوقت + أرجع المخزون
      // مهم: لا نرجّع المخزون إلا إذا كان قد خُصم فعلاً (عند CONFIRMED)
      if (status === "CANCELLED") {
        updateData.cancelledAt = new Date();
        if (cancelledReason) updateData.cancelledReason = cancelledReason;

        if (order.stockDeducted) {
          // ⚠ Phase 4: لازم نرجّع (qty - returnedQty) مش qty.
          // لو حصل تسليم جزئي قبل الإلغاء، الكميات الراجعة رجعت للمخزون سواها.
          // لو رجعنا qty كاملة، المخزون يطلع مكرر (تسريب مخزون).
          await Promise.all(
            order.items.map((item) => {
              const toRestock = Math.max(0, item.qty - item.returnedQty);
              if (toRestock === 0) return Promise.resolve();
              return tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQty: { increment: toRestock } },
              });
            })
          );
          updateData.stockDeducted = false;
        }
      }

      // عند التأكيد لأول مرة: اخصم المخزون
      // Phase 4: الخصم كان read-then-write وبwas ممكن يطلع بالسالب لو
      // طلبين اتأكدوا في نفس اللحظة على نفس الـ variant. دلوقتي بنستخدم
      // updateMany شرطه stockQty >= qty — العملية ذرّية جوه الـ transaction،
      // فإما بتنجح كاملة أو ما بتنقصش حاجة.
      if (status === "CONFIRMED" && order.status === "PENDING") {
        // نفس الـ variant ممكن يتكرر في نفس الطلب (مفيش unique على
        // orderId+variantId) فنجمّع الكميات الأول.
        const needed = new Map();
        for (const item of order.items) {
          needed.set(item.variantId, (needed.get(item.variantId) || 0) + item.qty);
        }

        for (const [variantId, qty] of needed) {
          const res = await tx.productVariant.updateMany({
            where: { id: variantId, stockQty: { gte: qty } },
            data: { stockQty: { decrement: qty } },
          });

          if (res.count === 0) {
            // نجيب اسم المنتج والتوفّر الحالي باش رسالة مفهومة للأدمن
            const v = await tx.productVariant.findUnique({
              where: { id: variantId },
              select: {
                stockQty: true,
                option1: true,
                option2: true,
                product: { select: { name: true } },
              },
            });
            const label = [
              v?.product?.name,
              v?.option1,
              v?.option2,
            ]
              .filter(Boolean)
              .join(" - ");
            throw new Error(
              `INSUFFICIENT_STOCK:${label || `variant #${variantId}`}|${qty}|${v?.stockQty ?? 0}`
            );
          }
        }

        updateData.stockDeducted = true;
      }

      // التحديث
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          deliveryCity: { select: { id: true, name: true, code: true } },
          deliveryArea: { select: { id: true, name: true } },
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      images: { where: { isPrimary: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // تسجيل حركة الحالة
      await tx.orderStatusLog.create({
        data: {
          orderId,
          status,
          actorType: req.user?.role === "DELIVERY" ? "DELIVERY" : "ADMIN",
          actorId: req.user?.sub ?? null,
          note: cancelledReason || null,
        },
      });

      return updated;
    });

    // ===== بعد نجاح الترانزكشن: أرسل إشعار حسب الحالة =====
    try {
      const type = mapStatusToNotificationType[updatedOrder.status] || "SYSTEM";
      const { title, body } = buildOrderStatusMessage({
        status: updatedOrder.status,
        orderNumber: updatedOrder.orderNumber,
      });

      await sendUserNotification({
        userId: updatedOrder.userId,
        type,
        title,
        body,
        data: {
          orderId: String(updatedOrder.id),
          orderNumber: updatedOrder.orderNumber,
        },
      });
    } catch (e) {
      console.error("Failed to send order status notification:", e.message);
    }

    return sendSuccess(
      res,
      { order: updatedOrder, message: "تم تحديث حالة الطلب بنجاح" },
      200
    );
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }
    if (error.message === "DELIVERY_REQUIRES_SETTLE") {
      return sendFail(
        res,
        {
          message:
            "حالة التسليم (كامل/جزئي) بتتحدد من صفحة التوصيل فقط — عشان نسجّل الكميات المسلّمة والمبلغ المقبوض بشكل صحيح.",
          code: "DELIVERY_REQUIRES_SETTLE",
        },
        400
      );
    }
    if (error.message.startsWith("INVALID_TRANSITION:")) {
      return sendFail(
        res,
        { message: error.message.replace("INVALID_TRANSITION:", "") },
        400
      );
    }
    if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
      // [name, required, available]
      const [name, required, available] = error.message
        .replace("INSUFFICIENT_STOCK:", "")
        .split("|");
      return sendFail(
        res,
        {
          message: `المخزون غير كافٍ: «${name}» — المطلوب ${required} والمتاح ${available}. عدّل المخزون أو ألغي الطلب.`,
          code: "INSUFFICIENT_STOCK",
          product: name,
          required: Number(required),
          available: Number(available),
        },
        409
      );
    }
    return sendError(res, error.message, 500);
  }
};

// DELETE /api/admin/orders/:id - حذف طلب (للأدمن فقط)
exports.deleteOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }

    // منع حذف الطلبات النشطة
    if (order.status !== "CANCELLED") {
      return sendFail(
        res,
        {
          message:
            "لا يمكن حذف الطلب إلا إذا كان ملغى. يمكنك إلغاء الطلب أولاً ثم حذفه",
        },
        400
      );
    }

    // حذف الطلب (سيحذف تلقائياً OrderItems بسبب onDelete: Cascade في Prisma)
    await prisma.order.delete({
      where: { id: orderId },
    });

    return sendSuccess(res, { message: "تم حذف الطلب بنجاح" }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};
