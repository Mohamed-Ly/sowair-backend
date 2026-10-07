// routes/auth.routes.js
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const {
  registerValidation,
  loginValidation,
  verifyOtpValidation,
  resendOtpValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require("../middlewares/validators");
const { handleValidation } = require("../middlewares/handleValidation");
const {
  register,
  login,
  refresh,
  logoutAll,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controller");
const verifyToken = require("../middlewares/verifyToken");

// تقييد مخصص لمسارات OTP: كل مسار منها يرسل SMS حقيقي، فنمنع التخمين/الإزعاج
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 30,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// تسجيل (نية): يتحقق التفرّد ثم يرسل OTP — ولا يُنشئ المستخدم إلا بعد verify-otp
router.post("/register", otpLimiter, registerValidation, handleValidation, register);

// دخول (identifier = email أو phone)
router.post("/login", loginValidation, handleValidation, login);

// التحقق من رمز التحقق (إنشاء الحساب / التحقق لإعادة التعيين)
router.post("/verify-otp", otpLimiter, verifyOtpValidation, handleValidation, verifyOtp);

// إعادة إرسال رمز التحقق (مهلة 60 ثانية)
router.post("/resend-otp", otpLimiter, resendOtpValidation, handleValidation, resendOtp);

// نسيت كلمة المرور (يبعث OTP للهاتف المسجل — برد موحّد)
router.post("/forgot-password", otpLimiter, forgotPasswordValidation, handleValidation, forgotPassword);

// إعادة تعيين كلمة المرور بعد التحقق من OTP
router.post("/reset-password", otpLimiter, resetPasswordValidation, handleValidation, resetPassword);

// إصدار Access جديد من Refresh
router.post("/refresh", refresh);

// إلغاء/خروج (يبطّل الـ refresh في DB)
// router.post("/logout", logout);

router.post("/logout-all", verifyToken, logoutAll);

module.exports = router;