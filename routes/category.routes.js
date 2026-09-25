const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const upload = require("../middlewares/upload");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  createCategoryValidation,
  updateCategoryValidation,
  categoryIdParamValidation
} = require("../middlewares/validators");

const {
  createCategory,
  listCategories,
  getCategory,
  countCategories,
  updateCategory,
  deleteCategory
} = require("../controllers/category.controller");

// عامة
router.get("/", listCategories);
router.get("/count", verifyToken, checkRole("ADMIN"), countCategories);
router.get("/:id", categoryIdParamValidation, handleValidation, getCategory);

// أدمن (ملف صورة اختياري للحقل image أو نص URL في JSON)
router.post("/", verifyToken, checkRole("ADMIN"), upload.single("image"), createCategoryValidation, handleValidation, createCategory);
router.patch("/:id", verifyToken, checkRole("ADMIN"), upload.single("image"), updateCategoryValidation, handleValidation, updateCategory);
router.delete("/:id", verifyToken, checkRole("ADMIN"), categoryIdParamValidation, handleValidation, deleteCategory);

module.exports = router;
