const router = require("express").Router();
const verifyToken = require("../middlewares/verifyToken");
const checkRole = require("../middlewares/checkRole");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  createCityValidation,
  updateCityValidation,
  createAreaValidation,
  updateAreaValidation,
  supplierIdParamValidation,
} = require("../middlewares/validators");

const {
  listCities,
  getCity,
  createCity,
  updateCity,
  deleteCity,
  listAreas,
  createArea,
  updateArea,
  deleteArea,
} = require("../controllers/location.controller");

// ========================== ADMIN ==========================
// هذا الراوترك كله admin، ومركّب في /api/admin/locations
// (الراوترات العامة في public-location.routes.js)
router.get("/cities", verifyToken, checkRole("ADMIN"), listCities);
router.get("/cities/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, handleValidation, getCity);
router.post("/cities", verifyToken, checkRole("ADMIN"), createCityValidation, handleValidation, createCity);
router.patch("/cities/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, updateCityValidation, handleValidation, updateCity);
router.delete("/cities/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, handleValidation, deleteCity);

router.get("/areas", verifyToken, checkRole("ADMIN"), listAreas);
router.post("/areas", verifyToken, checkRole("ADMIN"), createAreaValidation, handleValidation, createArea);
router.patch("/areas/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, updateAreaValidation, handleValidation, updateArea);
router.delete("/areas/:id", verifyToken, checkRole("ADMIN"), supplierIdParamValidation, handleValidation, deleteArea);

module.exports = router;
