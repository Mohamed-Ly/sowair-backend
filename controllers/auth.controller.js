// controllers/auth.controller.js
const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendSuccess, sendFail, sendError } = require("../utils/responseHelper");
const { generateAccessToken, generateRefreshToken, hashToken } = require("../utils/JWTHelper");
const { mergeGuestCartAndWishlistToUser } = require("../utils/guestMerge");

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET_KEY;

// أداة مساعدة لحساب انتهاء الريفريش (مطابقة REFRESH_EXP ≈ 7 أيام)
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// دمج سلة ومفضلة الزائر مع حساب المستخدم إن وُجد guestId
async function mergeGuestData(req, userId) {
  const guestId = req.headers["x-guest-id"];
  if (!guestId || !String(guestId).trim()) return;
  try {
    const result = await mergeGuestCartAndWishlistToUser(
      userId,
      String(guestId).trim()
    );
    if (result.cartMerged || result.wishlistMerged) {
      console.log(
        `🧩 دمج بيانات الزائر → تم نقل ${result.cartMerged} عنصر سلة و ${result.wishlistMerged} منتج مفضلة`
      );
    }
  } catch (e) {
    console.error("❌ فشل دمج بيانات الزائر:", e.message);
  }
}

async function issueTokensAndPersist(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // خزّن hash(refresh) مع expiry
  const tokenHash = hashToken(refreshToken);
  const expiresAt = addDays(new Date(), 30); // طابق REFRESH_EXP

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  return { accessToken, refreshToken };
}

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { id: true }
    });
    if (exists) {
      return sendFail(res, { message: "البريد أو الهاتف مستخدم بالفعل" }, 400);
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, phone, password: hash },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    });

    const { accessToken, refreshToken } = await issueTokensAndPersist(user);

    // دمج بيانات الزائر (سلة/مفضلة) مع الحساب الجديد
    await mergeGuestData(req, user.id);

    return sendSuccess(res, { user, accessToken, refreshToken }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] }
    });
    if (!user) return sendFail(res, { message: "بيانات الدخول غير صحيحة" }, 401);

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return sendFail(res, { message: "بيانات الدخول غير صحيحة" }, 401);

    const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt };
    const { accessToken, refreshToken } = await issueTokensAndPersist(user);

    // دمج بيانات الزائر (سلة/مفضلة) مع الحساب عند تسجيل الدخول
    await mergeGuestData(req, user.id);

    return sendSuccess(res, { user: safeUser, accessToken, refreshToken }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};


// لو حاب تستخدم نفس REFRESH_EXP النصّي من JWTHelper:
const REFRESH_DAYS = 30; // طابق "30d" في JWTHelper


// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body; // أو من كوكي
    if (!refreshToken) return sendFail(res, { message: "Refresh token is required" }, 400);

    // 1) تحقق التوقيع
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET); // { sub: userId, iat, exp }
    } catch {
      return sendFail(res, { message: "Invalid or expired refresh token" }, 401);
    }

    // 2) تحقق وجوده بالقاعدة وعدم إبطاله/انتهائه
    const oldHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return sendFail(res, { message: "Refresh token is not valid" }, 401);
    }

    // 3) اجلب المستخدم
    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) return sendFail(res, { message: "User not found" }, 404);

    // 4) ابطل القديم (Rotation)
    await prisma.refreshToken.update({
      where: { tokenHash: oldHash },
      data: { revokedAt: new Date() } // lastUsedAt اختياري
    });

    // 5) أصدر جديدين
    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);

    // 6) خزّن هاش الريفريش الجديد
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefresh),
        expiresAt: addDays(new Date(), REFRESH_DAYS)
      }
    });

    return sendSuccess(res, { accessToken: newAccess, refreshToken: newRefresh }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};

// POST /api/auth/logoutAll
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return sendFail(res, { message: "Unauthorized" }, 401);

    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    return sendSuccess(res, { message: "تم تسجيل الحروج بنجاح" }, 200);
  } catch (e) {
    return sendError(res, e.message, 500);
  }
};
