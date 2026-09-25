const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const { reportsQueryValidation } = require("../middlewares/validators");

const {
  getSummaryReport,
  getProductsReport,
  getOrderStatusReport,
  exportReport,
} = require("../controllers/reports.controller");

// كل مسارات التقارير خاصة بالأدمن فقط
router.use(verifyToken, checkRole("ADMIN"));

router.get(
  "/summary",
  reportsQueryValidation,
  handleValidation,
  getSummaryReport
);
router.get(
  "/products",
  reportsQueryValidation,
  handleValidation,
  getProductsReport
);
router.get(
  "/orders-status",
  reportsQueryValidation,
  handleValidation,
  getOrderStatusReport
);
router.get(
  "/export",
  reportsQueryValidation,
  handleValidation,
  exportReport
);

module.exports = router;