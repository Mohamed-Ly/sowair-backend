const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const upload = require("../middlewares/upload");
const { handleValidation } = require("../middlewares/handleValidation");

const {
  createBrandValidation,
  updateBrandValidation,
  brandIdParamValidation,
//   brandListQueryValidation
} = require("../middlewares/validators");

const {
  createBrand,
  listBrands,
  getBrand,
  updateBrand,
  deleteBrand,
  countBrands
} = require("../controllers/brand.controller");

// عامة (قائمة/قراءة)
router.get("/", handleValidation, listBrands);
router.get("/count", verifyToken, checkRole("ADMIN"), handleValidation, countBrands);
router.get("/:id", brandIdParamValidation, handleValidation, getBrand);

// أدمن إنشاء/تحديث/حذف (حقل image: ملف اختياري أو نص URL في JSON)
router.post("/", verifyToken, checkRole("ADMIN"), upload.single("image"), createBrandValidation, handleValidation, createBrand);
router.patch("/:id", verifyToken, checkRole("ADMIN"), upload.single("image"), updateBrandValidation, handleValidation, updateBrand);
router.delete("/:id", verifyToken, checkRole("ADMIN"), brandIdParamValidation, handleValidation, deleteBrand);

module.exports = router;
