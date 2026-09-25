// routes/product.routes.js
const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const upload = require("../middlewares/upload");
const { handleValidation } = require("../middlewares/handleValidation");

const {
  createProductValidation,
  updateProductValidation,
  productIdParamValidation,
//   productListQueryValidation,
} = require("../middlewares/validators");

const {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  countProducts,
} = require("../controllers/product.controller");

// عامة
router.get("/", listProducts);

// عدّاد (لوحة التحكم) — ضعه قبل :id لتفادي التعارض
router.get(
  "/count",
  verifyToken,
  checkRole("ADMIN"),
//   productListQueryValidation,
  handleValidation,
  countProducts
);

// تفاصيل
router.get("/:id", productIdParamValidation, handleValidation, getProduct);

// أدمن: إنشاء/تعديل/حذف
router.post(
  "/",
  verifyToken,
  checkRole("ADMIN"),
  upload.array("images", 5),
  createProductValidation,
  handleValidation,
  createProduct
);

router.patch(
  "/:id",
  verifyToken,
  checkRole("ADMIN"),
  upload.array("images", 5),
  updateProductValidation,
  handleValidation,
  updateProduct
);

router.delete(
  "/:id",
  verifyToken,
  checkRole("ADMIN"),
  productIdParamValidation,
  handleValidation,
  deleteProduct
);

module.exports = router;
