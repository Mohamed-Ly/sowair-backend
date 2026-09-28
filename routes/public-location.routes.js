const router = require("express").Router();
const { handleValidation } = require("../middlewares/handleValidation");
const { quoteFeeValidation } = require("../middlewares/validators");
const { publicCities, publicAreas, quoteFee } = require("../controllers/location.controller");

// endpoints ديال الـ checkout — ما كايتطلبوش توكن.
// مركّبة في /api/locations
router.get("/cities", publicCities);
router.get("/cities/:id/areas", publicAreas);
router.post("/fee", quoteFeeValidation, handleValidation, quoteFee);

module.exports = router;
