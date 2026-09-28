const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  createSupplierValidation,
  updateSupplierValidation,
  supplierIdParamValidation
} = require("../middlewares/validators");

const {
  createSupplier,
  listSuppliers,
  getSupplier,
  countSuppliers,
  updateSupplier,
  deleteSupplier
} = require("../controllers/supplier.controller");

router.get("/", verifyToken, checkRole("ADMIN"), listSuppliers);
router.get("/count", verifyToken, checkRole("ADMIN"), countSuppliers);
router.get("/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, handleValidation, getSupplier);
router.post("/", verifyToken, checkRole("ADMIN"), createSupplierValidation, handleValidation, createSupplier);
router.patch("/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, updateSupplierValidation, handleValidation, updateSupplier);
router.delete("/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, handleValidation, deleteSupplier);

module.exports = router;
