// utils/responseHelper.js

exports.sendSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    status: "success",
    data
  });
};

exports.sendFail = (res, data = {}, statusCode = 400) => {
  return res.status(statusCode).json({
    status: "fail",
    data
  });
};

exports.sendError = (res, message = "Something went wrong", statusCode = 500) => {
  return res.status(statusCode).json({
    status: "error",
    message
  });
};

// خطأ منطقي (مشكلة في طلب العميل، مش في السيرفر).
// بنستعملوه جوه الـ transaction — أي error عادي جوا $transaction
// بيروح للـ catch وكيتبعت 500، حتى لو كان خطأ تحقق عادي.
// الـ BusinessError بيخلي الـ catch يعرف يرجّع 400 بدل 500.
class BusinessError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "BusinessError";
    this.statusCode = statusCode;
  }
}

// اختصار: throw businessError("رسالة") بدل new BusinessError(...)
const businessError = (message, statusCode = 400) => {
  throw new BusinessError(message, statusCode);
};

// بنستعملوها في catch blocks: هل الخطأ منطقي ولا خطأ سيرفر
const isBusinessError = (e) => e instanceof BusinessError || e?.name === "BusinessError";

exports.BusinessError = BusinessError;
exports.businessError = businessError;
exports.isBusinessError = isBusinessError;
