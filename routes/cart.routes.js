// routes/cart.routes.js
const router = require("express").Router();
const { optionalAuth } = require("../middlewares/verifyToken");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  addCartItemValidation,
  updateCartItemValidation,
  removeCartItemParamValidation
} = require("../middlewares/validators");

const {
  getCart,
  addItem,
  updateItemQty,
  removeItem,
  clearCart,
  countCart
} = require("../controllers/cart.controller");

// مسارات السلة تسمح للمستخدم المسجّل أو الزائر (عبر x-guest-id)
router.use(optionalAuth);

// عرض السلة
router.get("/", getCart);

// عدّاد (للواجهة)
router.get("/count", countCart);

// إضافة عنصر
router.post("/items", addCartItemValidation, handleValidation, addItem);

// تعديل كمية عنصر
router.patch("/items/:itemId", updateCartItemValidation, handleValidation, updateItemQty);

// حذف عنصر
router.delete("/items/:itemId", removeCartItemParamValidation, handleValidation, removeItem);

// إفراغ السلة
router.delete("/clear", clearCart);

module.exports = router;
