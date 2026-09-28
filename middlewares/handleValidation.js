// middlewares/handleValidation.js
const { validationResult } = require("express-validator");
const { sendFail } = require("../utils/responseHelper");

exports.handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = {};
    errors.array().forEach(err => {
      // express-validator 7 بقى يستعمل `path` بدل `param`.
      // بـ `err.param` كانت كل الأخطاء بتتقفل تحت مفتاح واحد "undefined".
      const key = err.path || err.param || err.field;
      formattedErrors[key] = err.msg;
    });
    return sendFail(res, { message: "فشل التحقق من البيانات", errors: formattedErrors }, 422);
  }
  next();
};
