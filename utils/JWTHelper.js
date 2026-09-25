// utils/JWTHelper.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;              // موجود عندك
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET_KEY; // أضِفه في .env

// مدد الصلاحية (عدّلها كما تريد)
const ACCESS_EXP = "15m";
const REFRESH_EXP = "30d";

// حمولة خفيفة تكفي للتعرّف على المستخدم
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, phone: user.phone, role: user.role },
    JWT_SECRET_KEY,
    { expiresIn: ACCESS_EXP }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_EXP }
  );
}

// هاش للـ refresh token قبل التخزين
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
};
