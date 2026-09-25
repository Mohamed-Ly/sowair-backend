const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const { buildOrderStatusMessage } = require("../services/order-notification.templates");
const { sendUserNotification } = require("../services/notification.service");

const ORDER_INCLUDE = {
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
};

// ========================== ADMIN ==========================
// POST /api/delivery/admin/assign - تعيين مندوب لطلب
exports.assignDelivery = async (req, res) => {
  try {
    const { orderId, deliveryId, note } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return sendFail(res, { message: "الطلب غير موجود" }, 404);
    }

    const deliverer = await prisma.user.findFirst({
      where: { id: deliveryId, role: "DELIVERY" },
    });
    if (!deliverer) {
      return sendFail(res, { message: "المندوب غير موجود" }, 400);
    }

    if (!["PENDING", "CONFIRMED", "SHIPPING"].includes(order.status)) {
      return sendFail(
        res,
        { message: "لا يمكن تعيين مندوب لهذا الطلب في حالته الحالية" },
        400
      );
    }

    const existing = await prisma.deliveryAssignment.findUnique({
      where: { orderId },
    });
    if (existing) {
      return sendFail(
        res,
        {
          message: "هذا الطلب معيّن بالفعل لمندوب",
          assignment: existing,
        },
        400
      );
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.create({
        data: { orderId, deliveryId, status: "ASSIGNED", note: note || null },
        include: {
          order: { include: ORDER_INCLUDE },
          deliveryUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          status: order.status,
          actorType: "ADMIN",
          actorId: req.user?.sub ?? null,
          note: `تم تعيين المندوب: ${deliverer.name}`,
        },
      });

      return a;
    });

    // إشعار المندوب بمهمة جديدة
    try {
      await sendUserNotification({
        userId: deliveryId,
        type: "SYSTEM",
        title: "لديك مهمة توصيل جديدة",
        body: `تم تعيين طلب رقم ${order.orderNumber} إليك. افتح التطبيق لعرض التفاصيل.`,
        data: {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
          deliveryId: String(deliveryId),
          status: "ASSIGNED",
          entityType: "delivery",
        },
      });
    } catch (e) {
      console.error("Failed to send assignment notification:", e.message);
    }

    return sendSuccess(
      res,
      { assignment, message: "تم تعيين المندوب للطلب بنجاح" },
      201
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/delivery/admin/assignments - كل التعيينات
exports.getAllAssignments = async (req, res) => {
  try {
    const assignments = await prisma.deliveryAssignment.findMany({
      include: {
        order: { include: ORDER_INCLUDE },
        deliveryUser: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return sendSuccess(res, { assignments }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/delivery/admin/deliverers - قائمة المندوبين
exports.getDeliverers = async (req, res) => {
  try {
    const deliverers = await prisma.user.findMany({
      where: { role: "DELIVERY" },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { id: "desc" },
    });

    return sendSuccess(res, { deliverers }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ========================== DELIVERY USER ==========================
// GET /api/delivery/assigned - طلباتي المعينة
exports.getMyAssignments = async (req, res) => {
  try {
    const userId = req.user.sub;

    const assignments = await prisma.deliveryAssignment.findMany({
      where: { deliveryId: userId, status: { in: ["ASSIGNED", "ACCEPTED"] } },
      include: {
        order: { include: ORDER_INCLUDE },
      },
      orderBy: { assignedAt: "desc" },
    });

    return sendSuccess(res, { assignments }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// GET /api/delivery/history - سجل تسليماتي
exports.getDeliveryHistory = async (req, res) => {
  try {
    const userId = req.user.sub;

    const assignments = await prisma.deliveryAssignment.findMany({
      where: { deliveryId: userId, status: { in: ["DELIVERED", "CANCELLED"] } },
      include: { order: { include: ORDER_INCLUDE } },
      orderBy: { deliveredAt: "desc" },
    });

    return sendSuccess(res, { assignments }, 200);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/delivery/accept/:assignmentId - قبول المهمة
exports.acceptAssignment = async (req, res) => {
  try {
    const userId = req.user.sub;
    const assignmentId = parseInt(req.params.assignmentId);

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, deliveryId: userId },
    });

    if (!assignment) {
      return sendFail(res, { message: "المهمة غير موجودة" }, 404);
    }
    if (assignment.status !== "ASSIGNED") {
      return sendFail(res, { message: "المهمة مقبولة أو منتهية بالفعل" }, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.update({
        where: { id: assignmentId },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      const order = await tx.order.update({
        where: { id: assignment.orderId },
        data: { status: "SHIPPING" },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: assignment.orderId,
          status: "SHIPPING",
          actorType: "DELIVERY",
          actorId: userId,
          note: "قبل المندوب المهمة وبدأ التوصيل",
        },
      });

      return { a, order };
    });

    // إشعار العميل بأن الطلب في طريقه إليه
    try {
      const { title, body } = buildOrderStatusMessage({
        status: "SHIPPING",
        orderNumber: updated.order.orderNumber,
      });
      await sendUserNotification({
        userId: updated.order.userId,
        type: "ORDER_SHIPPED",
        title,
        body,
        data: {
          orderId: String(updated.order.id),
          orderNumber: updated.order.orderNumber,
        },
      });
    } catch (e) {
      console.error("Failed to send shipping notification:", e.message);
    }

    return sendSuccess(
      res,
      { assignment: updated.a, order: updated.order, message: "تم قبول المهمة" },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// PATCH /api/delivery/delivered/:assignmentId - إتمام التسليم
exports.completeDelivery = async (req, res) => {
  try {
    const userId = req.user.sub;
    const assignmentId = parseInt(req.params.assignmentId);

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, deliveryId: userId },
    });

    if (!assignment) {
      return sendFail(res, { message: "المهمة غير موجودة" }, 404);
    }
    if (assignment.status === "DELIVERED") {
      return sendFail(res, { message: "تم تسليم هذا الطلب من قبل" }, 400);
    }
    if (assignment.status === "CANCELLED") {
      return sendFail(res, { message: "هذه المهمة ملغاة" }, 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: assignment.orderId },
    });

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.deliveryAssignment.update({
        where: { id: assignmentId },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });

      const updatedOrder = await tx.order.update({
        where: { id: assignment.orderId },
        data: { status: "DELIVERED" },
        include: ORDER_INCLUDE,
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: assignment.orderId,
          status: "DELIVERED",
          actorType: "DELIVERY",
          actorId: userId,
          note: "تم تسليم الطلب بنجاح",
        },
      });

      return { a, updatedOrder };
    });

    // إشعار العميل بالتسليم
    try {
      const { title, body } = buildOrderStatusMessage({
        status: "DELIVERED",
        orderNumber: order.orderNumber,
      });
      await sendUserNotification({
        userId: order.userId,
        type: "ORDER_DELIVERED",
        title,
        body,
        data: {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
        },
      });
    } catch (e) {
      console.error("Failed to send delivered notification:", e.message);
    }

    return sendSuccess(
      res,
      {
        assignment: updated.a,
        order: updated.updatedOrder,
        message: "تم تأكيد تسليم الطلب بنجاح",
      },
      200
    );
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};