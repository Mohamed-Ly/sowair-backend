const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  userIdParamValidation,
  updateUserValidation,
  updateUserRoleValidation,
  //   adminUsersQueryValidation,
} = require("../middlewares/validators");

const {
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  getUsersCount,
  updateUserRole,
} = require("../controllers/user.controller");

// ===================== PUBLIC ROUTES =====================
router.get("/count", verifyToken, checkRole("ADMIN"), getUsersCount);

// 🔓 عام: أي مستخدم مسجل يمكنه رؤية بياناته
router.get(
  "/:id",
  verifyToken,
  userIdParamValidation,
  handleValidation,
  getSingleUser
);

// ===================== USER ROUTES =====================
// 👤 المستخدم والادمن يمكنهم تحديث بياناتهم
router.put(
  "/profile/:id",
  verifyToken,
  checkRole("ADMIN", "CUSTOMER", "DELIVERY"),
  updateUserValidation,
  handleValidation,
  updateUser
);

// ===================== ADMIN ROUTES =====================
// 🔧 أدمن فقط: إدارة المستخدمين
router.get(
  "/",
  verifyToken,
  checkRole("ADMIN"),
  //   adminUsersQueryValidation,
  handleValidation,
  getAllUsers
);

// 🗑️ مسارات الحذف المنفصلة
router.delete(
  "/profile/:id",
  verifyToken,
  checkRole("CUSTOMER"),
  userIdParamValidation,
  handleValidation,
  deleteUser
);
router.delete(
  "/admin/:id",
  verifyToken,
  checkRole("ADMIN"),
  userIdParamValidation,
  handleValidation,
  deleteUser
);

// 🎖️ تغيير دور مستخدم (تفعيل مندوب → DELIVERY)
router.patch(
  "/admin/:id/role",
  verifyToken,
  checkRole("ADMIN"),
  updateUserRoleValidation,
  handleValidation,
  updateUserRole
);

module.exports = router;
