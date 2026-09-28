// services/order-notification.templates.js

// خرائط التحويل بين حالة الطلب ونوع الإشعار (قيمة enum NotificationType)
const mapStatusToNotificationType = {
  PENDING: "ORDER_CREATED",
  CONFIRMED: "ORDER_CONFIRMED",
  SHIPPING: "ORDER_SHIPPED",
  PARTIALLY_DELIVERED: "ORDER_PARTIALLY_DELIVERED",
  DELIVERED: "ORDER_DELIVERED",
  CANCELLED: "ORDER_CANCELLED",
};

/**
 * توليد عنوان/نص مناسبين لحالة الطلب
 * استخدمه لوقت إنشاء الطلب (PENDING) وأي تغيّر لاحق
 */
function buildOrderStatusMessage({ status, orderNumber }) {
  switch (status) {
    case "PENDING":
      return {
        title: "تم استلام طلبك",
        body: `طلبك رقم ${orderNumber} قيد المراجعة وسنتواصل لتأكيده قريبًا.`,
      };
    case "CONFIRMED":
      return {
        title: "تم تأكيد طلبك",
        body: `تم تأكيد الطلب رقم ${orderNumber}. سنبدأ تجهيز الشحنة قريبًا.`,
      };
    case "SHIPPING":
      return {
        title: "طلبك في طريقه إليك",
        body: `تم شحن الطلب رقم ${orderNumber}. تابع حالة التوصيل من حسابك.`,
      };
    case "DELIVERED":
      return {
        title: "تم التسليم",
        body: `تم تسليم الطلب رقم ${orderNumber}. نتمنى لك تجربة ممتعة!`,
      };
    case "PARTIALLY_DELIVERED":
      return {
        title: "تم التسليم جزئياً",
        body: `تم تسليم جزء من الطلب رقم ${orderNumber}. البنود الراجعة تواصل معنا باش نرتبها.`,
      };
    case "CANCELLED":
      return {
        title: "تم إلغاء الطلب",
        body: `تم إلغاء الطلب رقم ${orderNumber}. إذا كان هذا غير مقصود، راسل الدعم.`,
      };
    default:
      return {
        title: "تحديث على طلبك",
        body: `تحديث جديد على الطلب رقم ${orderNumber}.`,
      };
  }
}

module.exports = {
  mapStatusToNotificationType,
  buildOrderStatusMessage,
};
