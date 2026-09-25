const router = require("express").Router();
const { optionalAuth } = require("../middlewares/verifyToken");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  wishlistItemValidation,
  wishlistItemIdParamValidation,
} = require("../middlewares/validators");

const {
  getWishlist,
  addItem,
  removeItem,
  clearWishlist,
  getWishlistCount,
  moveToCart,
} = require("../controllers/wishlist.controller");

// مسارات المفضلة تسمح للمستخدم المسجّل أو الزائر (عبر x-guest-id)

// عرض المفضلة
router.get("/", optionalAuth, getWishlist);

// عداد العناصر
router.get("/count", optionalAuth, getWishlistCount);

// إضافة منتج
router.post(
  "/items",
  optionalAuth,
  wishlistItemValidation,
  handleValidation,
  addItem
);

// إزالة منتج
router.delete(
  "/items/:id",
  optionalAuth,
  wishlistItemIdParamValidation,
  handleValidation,
  removeItem
);

// نقل منتج للسلة
router.post(
  "/items/:id/move-to-cart",
  optionalAuth,
  wishlistItemIdParamValidation,
  handleValidation,
  moveToCart
);

// إفراغ المفضلة
router.delete("/clear", optionalAuth, clearWishlist);

module.exports = router;
