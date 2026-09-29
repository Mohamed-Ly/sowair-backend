// routes/wallet.routes.js
const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  courierIdParamValidation,
  settleWalletValidation,
  adjustWalletValidation,
} = require("../middlewares/validators");

const {
  getAdminWallets,
  getCourierTransactions,
  settleWallet,
  adjustWallet,
} = require("../controllers/wallet.controller");

// ===================== ADMIN =====================
router.get("/", verifyToken, checkRole("ADMIN"), getAdminWallets);
router.get(
  "/:courierId/transactions",
  verifyToken,
  checkRole("ADMIN"),
  courierIdParamValidation,
  handleValidation,
  getCourierTransactions
);
router.post(
  "/:courierId/settle",
  verifyToken,
  checkRole("ADMIN"),
  courierIdParamValidation,
  settleWalletValidation,
  handleValidation,
  settleWallet
);
router.post(
  "/:courierId/adjust",
  verifyToken,
  checkRole("ADMIN"),
  courierIdParamValidation,
  adjustWalletValidation,
  handleValidation,
  adjustWallet
);

module.exports = router;