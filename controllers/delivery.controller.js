const prisma = require("../config/prisma");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const { buildOrderStatusMessage } = require("../services/order-notification.templates");
const { sendUserNotification } = require("../services/notification.service");
const { canTransition } = require("../services/order-status.service");

// البنود المكسورة جزئياً لازم تظهر في كل رد يعرض طلب
const SETTLED_INCLUDE = {
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
  deliveryCity: { select: { id: true, name: true, code: true } },
  deliveryArea: { select: { id: true, name: true } },
};

// بنرميه جوّه الـ transaction باش يعمل ROLLBACK كامل.
// ⚠ مهم: لو رجعنا `{ error }` عادي من الـ transaction، Prisma بيعمل COMMIT
// — يعني الكتابات اللي اتعملت قبل التحقق بتفضل محفوظة (تسريب مخزون).
// الرمي هو الوحيد اللي يضمن التراجع.
function settleError(status, message) {
  const e = new Error(message);
  e.settleStatus = status;
  e.isSettleError = true;
  return e;
}

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

// PATCH /api/delivery/delivered/:assignmentId - إتمام التسليم (كامل)
//
// Phase 4: ما بقاش فيه منطق خاص — غلاف فوق settleDelivery. قبل Phase 4
// كان كيعمل status=DELIVERED وما كانش بيسجل deliveredQty/collectedCents
// إطلاقاً، فكانت البيانات بتتقاسق مع الحالة (طلب DELIVERED وبنوده 0).
// دلوقتي مسار واحد بس عشان ما يحصلش اختلاف بين.endpoint والتاني.
exports.completeDelivery = async (req, res) => {
  try {
    const userId = req.user.sub;
    const assignmentId = parseInt(req.params.assignmentId);

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, deliveryId: userId },
      include: { order: { select: { items: { select: { id: true, qty: true } } } } },
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

    // كل بند يتسلّم بالكامل
    req.body = {
      items: assignment.order.items.map((i) => ({ orderItemId: i.id, deliveredQty: i.qty })),
      returnReason: undefined,
    };
    req.params.assignmentId = assignmentId;

    return exports.settleDelivery(req, res);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// ============================================================
// ================= Phase 4: التسليم الجزئي =================
// ============================================================
// POST /api/delivery/settle/:assignmentId
//
// المندوب بيبعت لكل بند الكمية اللي سلّمها بس. الكمية الراجعة بنحسبها
// الباج اند (qty - deliveredQty) مش بنثق في رقم المرسل — عشان كده مستحيل
// يبعت 0 ويخفي كمية ويسيب المخزون ناقص.
//
// القواعد:
//  - لازم يكون فيه بند واحد على الأقل اتسلّم (تسليم 100% راجع = rejected)
//  - كل بند في الطلب لازم يتقرّر فيه (عشان نعرف رجع كام بالظبط)
//  - المبلغ المقبوض = مجموع أرقام البنود المسلّمة (بعد الخصم) — الباج اند
//    هو المرجع دائماً، والرقم اللي بعتّه المندوب بنقارنه ونرجّعله الحق
//  - idempotent: بعد التسليم ما ينفعش يتسجل تاني (منع تحصيل مزدوج)
exports.settleDelivery = async (req, res) => {
  const userId = req.user.sub;
  const assignmentId = parseInt(req.params.assignmentId);
  const { items, collectedCents, returnReason } = req.body;

  let order = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.deliveryAssignment.findFirst({
        where: { id: assignmentId, deliveryId: userId },
        include: { order: { include: { items: true } } },
      });

      if (!assignment) {
        throw settleError(404, "المهمة غير موجودة");
      }
      if (assignment.status === "DELIVERED") {
        throw settleError(400, "تم تسليم هذا الطلب من قبل");
      }
      if (assignment.status === "CANCELLED") {
        throw settleError(400, "هذه المهمة ملغاة");
      }
      // المهمة لازم تكون لسه مفتوحة (مقبولة أو لسه ما اتقبلتش).
      if (!["ASSIGNED", "ACCEPTED"].includes(assignment.status)) {
        throw settleError(400, `المهمة في حالة «${assignment.status}» — ما يمكنش تسجّل تسليم`);
      }

      const ord = assignment.order;

      // `stockDeducted` هنا = "المخزون اتخصم فعلاً للطلب ده" (فعل تاريخي).
      // بعد التسليم الجزئي بيفضل true لأن الخصم حصل والطلب قفل — مش معناها
      // إن فيه مخزون لسه محجوز. الإلغاء مستحيل بعد التسليم، فمفيش مسار
      // يرجّع المخزون تاني ويقفل الحقل.
      if (!ord.stockDeducted) {
        throw settleError(400, "الطلب لسه ما اتأكدش — ما يمكنش نسجّل تسليم جزئي");
      }
      // ⚠ القاعدة الواحدة: التسليم بيتسجل من حالة SHIPPING بس.
      // DELIVERED و PARTIALLY_DELIVERED نهائيتين — لو وصلنا هنا يبقى
      // في بيانات متضاربة (assignment مفتوح + طلب مقفول) ونرفض عشان
      // ما يتحصّلش المبلغ مرتين.
      if (ord.status !== "SHIPPING") {
        throw settleError(
          400,
          `ما يمكنش نسجّل تسليم في حالة «${ord.status}» — التسليم بيتسجل من حالة «قيد الشحن» بس`
        );
      }

      // خريطة البنود: orderItemId -> الكمية المسلّمة
      const sent = new Map();
      for (const it of items) {
        const id = parseInt(it.orderItemId);
        if (sent.has(id)) {
          throw settleError(400, "بند مكرر في الطلب — كل بند يتقرّر مرة واحدة");
        }
        sent.set(id, parseInt(it.deliveredQty));
      }

      // كل بند في الطلب لازم يبقى في القائمة
      for (const item of ord.items) {
        if (!sent.has(item.id)) {
          throw settleError(
            400,
            `بند من الطلب (${item.qty} قطعة) ما اتقرّرش — لازم تبعت كل البنود`
          );
        }
      }

      // ⚠ ومقلوش بند من طلب تاني: أي معرّف زيادة عن بنود الطلب ده
      // لازم يترفض، مش يتجاهل بصمت.
      const ownIds = new Set(ord.items.map((i) => i.id));
      for (const id of sent.keys()) {
        if (!ownIds.has(id)) {
          throw settleError(400, `البند ${id} مش من هذا الطلب`);
        }
      }

      // ===== كل التحققات خلصت. دلوقتي بnjrf أي كتابة =====
      let anyDelivered = false;
      let expectedCents = 0;

      for (const item of ord.items) {
        const deliveredQty = sent.get(item.id);

        // safety net: منع الكميات المستحيلة
        if (deliveredQty < 0 || deliveredQty > item.qty) {
          throw settleError(
            400,
            `الكمية المسلّمة للبند ${item.id} غير منطقية (المطلوب ${item.qty})`
          );
        }

        if (deliveredQty > 0) anyDelivered = true;

        // نصيب البند من قيمة السطر بعد الخصم. نحسب النسبة بدل القسمة
        // على qty عشان ما نخسرش قرش واحد في التقريب.
        expectedCents += Math.round((item.lineTotalCents * deliveredQty) / item.qty);
      }

      // 100% راجع = مافيش تسليم. ده مش "جزئي"، ومحتاج مسار تاني.
      if (!anyDelivered) {
        throw settleError(
          400,
          "كل البضاعة رجعت — مافيش حاجة اتسلّمت. لو العميل رفض الطلب كامل، استخدم الإلغاء من صفحة الطلبات."
        );
      }

      const allDelivered = ord.items.every((i) => sent.get(i.id) === i.qty);
      const newStatus = allDelivered ? "DELIVERED" : "PARTIALLY_DELIVERED";

      // guard أخير قبل الكتابة
      const transition = canTransition(ord.status, newStatus);
      if (!transition.ok) {
        throw settleError(400, transition.reason);
      }

      // ===== الكتابة =====
      // ⚠ لازم await. قبل كنا كنحطّو الـ promises في مصفوفة من غير ما
      // نانتظروهم، فالتحديثات كانت بتنفذ بعد ما الـ transaction يخلص
      // (أو ما كانتش بتنفذ خالص) = deliveredQty بيفضل 0.
      for (const item of ord.items) {
        const deliveredQty = sent.get(item.id);
        const returnedQty = item.qty - deliveredQty;

        // المخزون يرجع للبنود الراجعة (مرة واحدة فقط — التحديث هنا نهائي)
        if (returnedQty > 0) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: returnedQty } },
          });
        }

        await tx.orderItem.update({
          where: { id: item.id },
          data: { deliveredQty, returnedQty },
        });
      }

      const updatedAssignment = await tx.deliveryAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          note: allDelivered
            ? assignment.note
            : `تسليم جزئي — ${returnReason || "بدون سبب محدد"}`.slice(0, 200),
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: ord.id },
        data: {
          status: newStatus,
          // authoritative: الرقم اللي حسبناه إحنا مش اللي بعتّه المندوب
          collectedCents: expectedCents,
          returnReason: allDelivered ? null : returnReason || null,
          partiallyDeliveredAt: allDelivered ? ord.partiallyDeliveredAt : new Date(),
        },
        include: SETTLED_INCLUDE,
      });

      const totalReturned = ord.items.reduce(
        (sum, i) => sum + (i.qty - sent.get(i.id)),
        0
      );

      await tx.orderStatusLog.create({
        data: {
          orderId: ord.id,
          status: newStatus,
          actorType: "DELIVERY",
          actorId: userId,
          note: allDelivered
            ? "تم تسليم الطلب بالكامل"
            : `تسليم جزئي: رجع ${totalReturned} قطعة${returnReason ? ` — ${returnReason}` : ""}`,
        },
      });

      // ===== محفظة المندوب: عمولة التوصيل =====
      // النسبة التناسبية: (كميات اتسلّمت فعلاً ÷ إجمالي كميات الطلب) × رسوم التوصيل
      // snapshot (اللي اتخزّنت على الطلب لحظة الإنشاء، مش السعر الحالي للمنطقة).
      // داخل نفس الـ transaction + الطلب مقفول نهائياً بعد التسليم = مفيش طريق
      // لإضافة عمولة مكررة على نفس الطلب أبداً.
      const totalQtySum = ord.items.reduce((s, i) => s + i.qty, 0);
      const deliveredQtySum = ord.items.reduce((s, i) => s + sent.get(i.id), 0);
      const courierEarning =
        totalQtySum > 0
          ? Math.round(ord.deliveryFeeCents * (deliveredQtySum / totalQtySum))
          : 0;
      if (courierEarning > 0) {
        await tx.walletTransaction.create({
          data: {
            courierId: userId,
            type: "EARNING",
            amountCents: courierEarning,
            refType: "ORDER",
            refId: ord.id,
            orderNumber: ord.orderNumber,
            deliveryFeeCents: ord.deliveryFeeCents,
            note: allDelivered
              ? `توصيل الطلب ${ord.orderNumber}`
              : `توصيل جزئي للطلب ${ord.orderNumber}`,
          },
        });
      }

      return {
        ok: true,
        assignment: updatedAssignment,
        order: updatedOrder,
        expectedCents,
        allDelivered,
        totalReturned,
        courierEarning,
      };
    });

    order = result.order;

    // إشعار العميل
    try {
      const { title, body } = buildOrderStatusMessage({
        status: order.status,
        orderNumber: order.orderNumber,
      });
      await sendUserNotification({
        userId: order.userId,
        type: order.status === "DELIVERED" ? "ORDER_DELIVERED" : "ORDER_PARTIALLY_DELIVERED",
        title,
        body,
        data: { orderId: String(order.id), orderNumber: order.orderNumber },
      });
    } catch (e) {
      console.error("Failed to send settle notification:", e.message);
    }

    // لو المندوب بعت مبلغ غلط، نرجعله الرقم الصح بوضوح
    const mismatch =
      collectedCents !== undefined && parseInt(collectedCents) !== result.expectedCents;

    return sendSuccess(
      res,
      {
        assignment: result.assignment,
        order,
        collectedCents: result.expectedCents,
        returnedTotal: result.totalReturned,
        courierEarning: result.courierEarning,
        ...(mismatch
          ? {
              warning: `المبلغ المتوقع ${result.expectedCents} قرش (مش ${collectedCents}). استعملنا الرقم المحسوب.`,
            }
          : {}),
        message: result.allDelivered
          ? "تم تسليم الطلب بالكامل"
          : "تم تسجيل التسليم الجزئي بنجاح",
      },
      200
    );
  } catch (error) {
    // خطأ تحقّق متوقّع: رجعناه زي ما هو (بعد rollback)
    if (error.isSettleError) {
      return sendFail(res, { message: error.message }, error.settleStatus);
    }
    return sendError(res, error.message, 500);
  }
};