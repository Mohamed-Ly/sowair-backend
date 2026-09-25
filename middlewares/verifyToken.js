// middlewares/verifyToken.js
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET_KEY;

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  

  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });

    req.user = user; // حفظ بيانات المستخدم في req
    next();
  });
};

// توثيق اختياري: إن وُجد توكن صالح يربطه، وإلا يتابع بدون تعيين req.user
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return next();
    req.user = user;
    next();
  });
};

module.exports = verifyToken; // للتوافق مع الاستيرادات القديمة
module.exports.optionalAuth = optionalAuth;
