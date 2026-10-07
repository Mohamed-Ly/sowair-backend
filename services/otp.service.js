// services/otp.service.js
// منطق رموز التحقق OTP: التوليد، التخزين (sha256)، التحقق، المهلة، التهدئة
const crypto = require("crypto");
const prisma = require("../config/prisma");
const resala = require("./resala.service");
const { businessError } = require("../utils/responseHelper");

const PIN_LENGTH = process.env.RESALA_PIN_LENGTH
  ? parseInt(process.env.RESALA_PIN_LENGTH, 10)
  : 6;
const PIN_TTL_MINUTES = 5; // صلاحية الرمز
const MAX_ATTEMPTS = 5; // الحد الأقصى للمحاولات الفاشلة
const RESEND_COOLDOWN_MS = 60 * 1000; // مهلة إعادة الإرسال (60 ثانية)

const OTP_PURPOSE = Object.freeze({
  REGISTER: "REGISTER",
  RESET_PASSWORD: "RESET_PASSWORD",
});

function generatePin() {
  return String(crypto.randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

// نخزّن sha256 فقط — لا نخزّن الرمز نصياً في القاعدة
function hashPin(pin) {
  return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

// مقارنة آمنة زمنياً (تجنب هجمات timing)
function pinsMatch(attemptPin, record) {
  try {
    const a = Buffer.from(hashPin(attemptPin), "hex");
    const b = Buffer.from(record.pinHash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// إصدار رمز OTP وإرساله عبر رسالة.
// - مهلة 60 ثانية بين الإرسال وإعادة الإرسال.
// - يُبطل أي رمز سابق غير مستهلك (يُترك الأخير فقط صالحاً).
// - عند إعادة الإرسال للتسجيل، تُحمل بيانات التسجيل الأصلية من آخر سجل.
async function issueOtp(phone, purpose, { metadata } = {}) {
  const latest = await prisma.otpCode.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (latest && latest.createdAt.getTime() + RESEND_COOLDOWN_MS > Date.now()) {
    const remaining = Math.ceil(
      (latest.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000
    );
    businessError(`يرجى الانتظار ${remaining} ثانية قبل إعادة إرسال الرمز`);
  }

  const payload = metadata ?? latest?.metadata;

  // إبطال كل الرموز السابقة غير المستهلكة لنفس الهاتف/الغرض
  await prisma.otpCode.updateMany({
    where: { phone, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  // ⭐ نطلب الرمز من المزوّد أولاً: /pins يرجّع الكود الفعلي المرسل للمستخدم،
  // ولنخزّن هاشه. (لا نولّد رمزاً محلياً أبداً — وإلا لم يطابق الكود الحقيقي)
  const otpValue = await otpCodeFromProvider(phone);

  const otp = await prisma.otpCode.create({
    data: {
      phone,
      purpose,
      pinHash: hashPin(otpValue),
      expiresAt: new Date(Date.now() + PIN_TTL_MINUTES * 60 * 1000),
      ...(payload ? { metadata: payload } : {}),
    },
  });

  // 🧪 وضع الاختبار فقط: مطبوع في السجل المحلي لسهولة التطوير، لا يُطبع في الإنتاج
  if (resala.TEST_MODE) {
    console.log(`[OTP:${purpose}] ${phone} → ${otpValue}`);
  }

  // نرجّع الرمز في وضع الاختبار فقط (تطوير محلي، لا يُكشف في الإنتاج)
  return { otpId: otp.id, ...(resala.TEST_MODE ? { devPin: otpValue } : {}) };
}

// طلب رمز تحقق من "رسالة" وإرجاع الكود الفعلي الذي يراه المستخدم
async function otpCodeFromProvider(phone) {
  const data = await resala.sendOtp(phone, { pinLength: PIN_LENGTH });
  const value = String(data?.pin ?? data?.code ?? "").trim();
  if (!/^\d{4,6}$/.test(value)) {
    businessError("لم يحصل المزوّد على رمز تحقق صالح — حاول مرة أخرى");
  }
  return value;
}

// التحقق من رمز OTP.
// - checkout على آخر رمز غير مستهلك وغير منتهي.
// - يزيد المحاولات الفاشلة ويُقفل عند تجاوز الحد (5).
// - الـ consume اختياري: يُستهلك الرمز بعد اكتمال العملية (تسجيل/إعادة تعيين).
async function verifyOtp(phone, purpose, pin, { consume = false } = {}) {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) businessError("لا يوجد رمز تحقق صالح لهذا الرقم — أعد إرساله أولاً");
  if (otp.expiresAt < new Date()) businessError("انتهت صلاحية رمز التحقق — أعد إرساله");
  if (otp.attempts >= MAX_ATTEMPTS)
    businessError("تجاوزت الحد المسموح من المحاولات — أعد إرسال رمز جديد");

  if (!pinsMatch(pin, otp)) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    businessError("رمز التحقق غير صحيح");
  }

  if (consume) await consumeOtp(otp.id);
  return otp;
}

async function consumeOtp(id) {
  await prisma.otpCode.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

module.exports = {
  OTP_PURPOSE,
  PIN_LENGTH,
  hashPin,
  generatePin,
  issueOtp,
  verifyOtp,
  consumeOtp,
};