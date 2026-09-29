const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  assignmentIdParamValidation,
  assignDeliveryValidation,
  settleDeliveryValidation,
} = require("../middlewares/validators");

const {
  assignDelivery,
  getAllAssignments,
  getDeliverers,
  getMyAssignments,
  getDeliveryHistory,
  acceptAssignment,
  completeDelivery,
  settleDelivery,
} = require("../controllers/delivery.controller");
const { getMyWallet } = require("../controllers/wallet.controller");

// ===================== ADMIN =====================
router.post(
  "/admin/assign",
  verifyToken,
  checkRole("ADMIN"),
  assignDeliveryValidation,
  handleValidation,
  assignDelivery
);
router.get(
  "/admin/assignments",
  verifyToken,
  checkRole("ADMIN"),
  getAllAssignments
);
router.get(
  "/admin/deliverers",
  verifyToken,
  checkRole("ADMIN"),
  getDeliverers
);

// ===================== DELIVERY USER =====================
router.get(
  "/assigned",
  verifyToken,
  checkRole("DELIVERY"),
  getMyAssignments
);
router.get(
  "/history",
  verifyToken,
  checkRole("DELIVERY"),
  getDeliveryHistory
);
router.get(
  "/wallet",
  verifyToken,
  checkRole("DELIVERY"),
  getMyWallet
);
router.patch(
  "/accept/:assignmentId",
  verifyToken,
  checkRole("DELIVERY"),
  assignmentIdParamValidation,
  handleValidation,
  acceptAssignment
);
router.patch(
  "/delivered/:assignmentId",
  verifyToken,
  checkRole("DELIVERY"),
  assignmentIdParamValidation,
  handleValidation,
  completeDelivery
);
// Phase 4: تسجيل التسليم الجزئي (المندوب بيبعت الكمية المسلّمة لكل بند)
router.post(
  "/settle/:assignmentId",
  verifyToken,
  checkRole("DELIVERY"),
  assignmentIdParamValidation,
  settleDeliveryValidation,
  handleValidation,
  settleDelivery
);

module.exports = router;