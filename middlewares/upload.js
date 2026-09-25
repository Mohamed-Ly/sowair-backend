const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// تأكد وجود مجلد uploads
fs.mkdirSync("uploads", { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(16).toString("hex");
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
const fileFilter = (req, file, cb) => {
  const extOk = allowedExts.includes(
    path.extname(file.originalname).toLowerCase()
  );
  if (allowedTypes.includes(file.mimetype) && extOk) cb(null, true);
  else
    cb(
      new Error("Only .jpg, .jpeg, .png and .webp files are allowed"),
      false
    );
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,                    // حد أقصى 5 صور
  },
});

module.exports = upload;
