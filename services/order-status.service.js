// services/order-status.service.js
// مصدر واحد لكل قواعد انتقال حالة الطلب. أي كود عايز يغيّر حالة
// لازم يمر من هنا باش ما يحصلش انتقال مستحيل (DELIVERED -> PENDING مثلاً).

// الحالات النهائية: منها ما بنرجعش
const TERMINAL = ["PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED"];

// خريطة الانتقالات المسموحة
// "SELF" = نفس الحالة (مفيش تغيير، مسموح كـ no-op)
const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "PARTIALLY_DELIVERED", "CANCELLED"],
  // ⚠ نهائية بالتصميم: البنود الراجعة رجعت للمخزون فعلاً وقت التسليم،
  // فما بقى عندنا حاجة نوصّلها تاني. الكمية الناقصة بتتعامل معاها
  // إجراءات الاسترجاع/الاستبدال (مش جزء من Phase 4).
  PARTIALLY_DELIVERED: [],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_LABELS = {
  PENDING: "قيد المراجعة",
  CONFIRMED: "مؤكد",
  SHIPPING: "قيد الشحن",
  PARTIALLY_DELIVERED: "تم التسليم جزئياً",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

/**
 * هل الانتقال من from إلى to مسموح؟
 * @returns {{ ok: boolean, reason?: string }}
 */
function canTransition(from, to) {
  if (from === to) return { ok: true };

  if (!STATUS_LABELS[to]) {
    return { ok: false, reason: `حالة غير معروفة: ${to}` };
  }
  if (TERMINAL.includes(from)) {
    return {
      ok: false,
      reason: `الطلب ${STATUS_LABELS[from]} — ما يمكنش يروح لـ«${STATUS_LABELS[to]}»`,
    };
  }
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `ما يمكنش ينتقل من «${STATUS_LABELS[from]}» لـ«${STATUS_LABELS[to]}»`,
    };
  }
  return { ok: true };
}

module.exports = {
  canTransition,
  ALLOWED_TRANSITIONS,
  TERMINAL,
  STATUS_LABELS,
};
