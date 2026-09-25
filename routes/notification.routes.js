const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const { optionalAuth } = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  notificationIdParamValidation,
  markAsReadValidation,
  createNotificationValidation,
  registerDeviceValidation,
  deviceTokenParamValidation,
} = require("../middlewares/validators");

const {
  getUserNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  getNotificationById,
  deleteNotification,
  createNotification,
  getAllNotifications,
  registerDevice,
  unregisterDevice,
} = require("../controllers/notification.controller");

// ===================== USER ROUTES =====================
// router.use(verifyToken);

router.get("/", verifyToken, getUserNotifications);
router.get("/stats", verifyToken, getNotificationStats);
router.get(
  "/:id",
  verifyToken,
  notificationIdParamValidation,
  handleValidation,
  getNotificationById
);
router.delete(
  "/:id",
  verifyToken,
  notificationIdParamValidation,
  handleValidation,
  deleteNotification
);
router.patch(
  "/read",
  verifyToken,
  markAsReadValidation,
  handleValidation,
  markAsRead
);
router.patch("/read-all", verifyToken, markAllAsRead);

// ===================== DEVICE TOKEN ROUTES (داخل Feature الإشعارات) =====================
// optionalAuth: يسمح بدون تسجيل دخول (أول تشغيل) ويربط التوكن بالمستخدم إن وُجد توكن صالح
router.post(
  "/devices/register",
  optionalAuth,
  registerDeviceValidation,
  handleValidation,
  registerDevice
);

router.delete(
  "/devices/:token",
  deviceTokenParamValidation,
  handleValidation,
  unregisterDevice
);

// ===================== ADMIN ROUTES =====================
// رابط انشاء الاشعار نقدر نخليه يرسل اشعار لكل المستخدمين ونقدر نستهدف مستخدم معين
router.post(
  "/admin",
  verifyToken,
  checkRole("ADMIN"),
  createNotificationValidation,
  handleValidation,
  createNotification
);
router.get("/admin/all", verifyToken, checkRole("ADMIN"), getAllNotifications);

module.exports = router;
