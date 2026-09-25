const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const { sendUserNotification } = require("../services/notification.service");
const {
  mapStatusToNotificationType,
  buildOrderStatusMessage,
} = require("../services/order-notification.templates");

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
    const { shippingName, shippingPhone, shippingAddress } = req.body;

    // نفّذ كل خطوات الإنشاء داخل Transaction وارجع الـ order
    const order = await prisma.$transaction(async (tx) => {
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
        throw new Error("السلة فارغة");
      }

      // 2) التحقق من التوفر والمخزون
      for (const item of cart.items) {
        if (!item.variant.isActive || !item.variant.product.isActive) {
          throw new Error(
            `المنتج ${item.variant.product.name} غير متاح حالياً`
          );
        }
        if (item.variant.stockQty < item.qty) {
          throw new Error(
            `الكمية المطلوبة من ${item.variant.product.name} تتجاوز المخزون المتاح`
          );
        }
      }

      // 3) حساب الإجمالي وبناء عناصر الطلب
      let totalCents = 0;
      const orderItemsData = cart.items.map((item) => {
        totalCents += item.variant.priceCents * item.qty;
        return {
          variantId: item.variant.id,
          unitPriceCents: item.variant.priceCents,
          qty: item.qty,
        };
      });

      // 4) إنشاء الطلب
      const created = await tx.order.create({
        data: {
          userId,
          totalCents,
          shippingName,
          shippingPhone,
          shippingAddress,
          orderNumber: generateOrderNumber(),
          cancelDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 ساعة
          items: { create: orderItemsData },
        },
        include: {
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
    // إن كانت رسالة "السلة فارغة" او أخطاء التحقق…
    if (error.message === "السلة فارغة") {
      return sendFail(res, { message: error.message }, 400);
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
  const txn = await prisma.$transaction(async (prisma) => {
    try {
      const userId = req.user.sub;
      const orderId = parseInt(req.params.id);
      const { reason } = req.body;

      const order = await prisma.order.findFirst({
        where: { id: orderId, userId },
      });

      if (!order) {
        return sendFail(res, { message: "الطلب غير موجود" }, 404);
      }

      // التحقق من الوقت (24 ساعة فقط)
      const orderTime = new Date(order.createdAt);
      const now = new Date();
      const hoursDiff = (now - orderTime) / (1000 * 60 * 60);

      if (order.cancelDeadline && new Date() > order.cancelDeadline) {
        return sendFail(
          res,
          {
            message: "لا يمكن إلغاء الطلب بعد مرور 24 ساعة من إنشائه",
          },
          400
        );
      }

      // التحقق من الحالة
      if (order.status !== "PENDING") {
        return sendFail(
          res,
          {
            message: "لا يمكن إلغاء الطلب بعد تأكيده",
          },
          400
        );
      }

      // تحديث الطلب
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledReason: reason || "ألغاه المستخدم",
          cancelledByUser: true,
        },
      });

      // إرجاع المخزون
      await returnStock(orderId);

      // تسجيل حركة الإلغاء
      await prisma.orderStatusLog.create({
        data: {
          orderId,
          status: "CANCELLED",
          actorType: "CUSTOMER",
          actorId: userId,
          note: reason || "ألغاه المستخدم",
        },
      });

      // إشعار المستخدم بالإلغاء
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
      throw error;
    }
  });
};

// دالة مساعدة: إرجاع المخزون
async function returnStock(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { variant: true } } },
  });

  await Promise.all(
    order.items.map((item) =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { increment: item.qty } },
      })
    )
  );
}

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
    } = req.query;

    // بناء where clause للتصفية
    const where = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { shippingName: { contains: search } },
        { shippingPhone: { contains: search } },
        { shippingAddress: { contains: search } },
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

      const updateData = { status };

      // عند الإلغاء: سجّل السبب والوقت + أرجع المخزون
      if (status === "CANCELLED") {
        updateData.cancelledAt = new Date();
        if (cancelledReason) updateData.cancelledReason = cancelledReason;

        await Promise.all(
          order.items.map((item) =>
            tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQty: { increment: item.qty } },
            })
          )
        );
      }

      // عند التأكيد لأول مرة: اخصم المخزون
      if (status === "CONFIRMED" && order.status === "PENDING") {
        await Promise.all(
          order.items.map((item) =>
            tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQty: { decrement: item.qty } },
            })
          )
        );
      }

      // التحديث
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
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
