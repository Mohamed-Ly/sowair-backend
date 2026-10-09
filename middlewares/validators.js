// middlewares/validation.js
const { body, param, query } = require("express-validator");
const prisma = require("../config/prisma");

// يسمح بأرقام تبدأ بـ + أو رقم، مع فراغات وشرطات
const phoneRegex = /^[+\d][\d\s-]{5,}$/;

// ======================= Auth =======================

exports.registerValidation = [
  body("name")
    .isLength({ min: 2, max: 50 })
    .withMessage("الاسم يجب أن يكون بين 2 و 50 حرفًا")
    .trim()
    .notEmpty()
    .withMessage("الاسم مطلوب"),
  // البريد الإلكتروني اختياري: يُترك فارغاً إن رغب المستخدم.
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("صيغة البريد الإلكتروني غير صحيحة")
    .trim()
    .normalizeEmail(),
  body("phone")
    .matches(phoneRegex)
    .withMessage("صيغة رقم الهاتف غير صحيحة")
    .trim()
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("كلمة المرور يجب ألا تقل عن 8 أحرف"),
];

exports.loginValidation = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("يرجى إدخال البريد الإلكتروني أو رقم الهاتف"),
  body("password").notEmpty().withMessage("يرجى إدخال كلمة المرور"),
];

// ======================= OTP =======================

const otpPurpose = ["REGISTER", "RESET_PASSWORD"];

const phoneBody = (field = "phone") =>
  body(field)
    .matches(phoneRegex)
    .withMessage("صيغة رقم الهاتف غير صحيحة")
    .trim()
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب");

const otpCodeBody = () =>
  body("otp")
    .matches(/^\d{4,6}$/)
    .withMessage("رمز التحقق غير صالح (4-6 أرقام)")
    .trim()
    .notEmpty()
    .withMessage("رمز التحقق مطلوب");

exports.verifyOtpValidation = [
  phoneBody(),
  body("purpose")
    .isIn(otpPurpose)
    .withMessage("الغرض من الرمز غير صالح")
    .notEmpty()
    .withMessage("الغرض من الرمز مطلوب"),
  otpCodeBody(),
];

exports.resendOtpValidation = [
  phoneBody(),
  body("purpose")
    .isIn(otpPurpose)
    .withMessage("الغرض من الرمز غير صالح")
    .notEmpty()
    .withMessage("الغرض من الرمز مطلوب"),
];

exports.forgotPasswordValidation = [phoneBody()];

exports.resetPasswordValidation = [
  phoneBody(),
  otpCodeBody(),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("كلمة المرور يجب ألا تقل عن 8 أحرف"),
];

// ======================= Categories =======================

exports.createCategoryValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("اسم التصنيف يجب أن يكون بين 2 و 60 حرفًا")
    .notEmpty()
    .withMessage("اسم التصنيف مطلوب"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("parentId")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ gt: 0 })
    .withMessage("التصنيف الأب غير صالح"),
];

exports.updateCategoryValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("اسم التصنيف يجب أن يكون بين 2 و 60 حرفًا"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("parentId")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ gt: 0 })
    .withMessage("التصنيف الأب غير صالح"),
];

exports.categoryIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
];

// ======================= Brand =======================
exports.createBrandValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("اسم الماركة يجب أن يكون بين 2 و 80 حرفًا")
    .notEmpty()
    .withMessage("اسم الماركة مطلوب"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("اسم الدولة غير صالح"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
];

exports.updateBrandValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("اسم الماركة يجب أن يكون بين 2 و 80 حرفًا"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("country")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("اسم الدولة غير صالح"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
];

exports.brandIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
];

// ======================= Products =======================
exports.createProductValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("اسم المنتج يجب أن يكون بين 2 و 120 حرفًا")
    .notEmpty()
    .withMessage("اسم المنتج مطلوب"),
  body("brand").optional().isString().withMessage("اسم الماركة غير صالح"),
  body("brandSlug").optional().isString().withMessage("سلاق الماركة غير صالح"),
  body("brandId")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("معرّف الماركة غير صالح"),
  body("category").optional().isString().withMessage("اسم التصنيف غير صالح"),
  body("categoryId")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("معرّف التصنيف غير صالح"),
  body("categorySlug")
    .optional()
    .isString()
    .withMessage("سلاق التصنيف غير صالح"),
  body().custom((value) => {
    // 🔽 تحديث: قبول brandId أو brand أو brandSlug
    if (!value.brand && !value.brandSlug && !value.brandId)
      throw new Error("يرجى تحديد الماركة بالاسم أو السلاق أو المعرّف");
    if (!value.category && !value.categorySlug && !value.categoryId)
      throw new Error("يرجى تحديد التصنيف بالاسم أو السلاق أو المعرّف");
    return true;
  }),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 160 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("الوصف طويل جدًا"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
];

// تحديث منتج
exports.updateProductValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("اسم المنتج يجب أن يكون بين 2 و 120 حرفًا"),
  body("brand").optional().isString().withMessage("اسم الماركة غير صالح"),
  body("brandSlug").optional().isString().withMessage("سلاق الماركة غير صالح"),
  body("brandId")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("معرّف الماركة غير صالح"),
  body("category").optional().isString().withMessage("اسم التصنيف غير صالح"),
  body("categoryId")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("معرّف التصنيف غير صالح"),
  body("categorySlug")
    .optional()
    .isString()
    .withMessage("سلاق التصنيف غير صالح"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 160 })
    .withMessage("السلاق يجب ألا يقل عن 2 أحرف"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("الوصف طويل جدًا"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("removeImageIds")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === "string") {
        try {
          return Array.isArray(JSON.parse(value));
        } catch {
          return false;
        }
      }
      return false;
    })
    .withMessage("قائمة الصور المراد حذفها يجب أن تكون مصفوفة"),
];

exports.productIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف غير صالح"),
];

// الاستعلام عن القائمة
// exports.productListQueryValidation = [
//   query("q").optional().isString().withMessage("قيمة البحث غير صالحة"),
//   query("brand").optional().isString().withMessage("اسم الماركة غير صالح"),
//   query("brandSlug").optional().isString().withMessage("سلاق الماركة غير صالح"),
//   query("category").optional().isString().withMessage("اسم التصنيف غير صالح"),
//   query("categorySlug").optional().isString().withMessage("سلاق التصنيف غير صالح"),
//   query("isActive").optional().isBoolean().withMessage("قيمة isActive غير صحيحة"),
//   query("page").optional().isInt({ gt: 0 }).withMessage("رقم الصفحة غير صالح"),
//   query("limit").optional().isInt({ gt: 0, lt: 101 }).withMessage("الحد يجب أن يكون بين 1 و 100"),
//   query("sortBy").optional().isIn(["createdAt","name"]).withMessage("حقل الترتيب غير مدعوم"),
//   query("order").optional().isIn(["asc","desc"]).withMessage("اتجاه الترتيب غير صالح"),
// ];

// ======================= Variants =======================

// :variantId في المسار
exports.variantIdParamValidation = [
  param("variantId").isInt({ gt: 0 }).withMessage("معرّف المتغير غير صالح"),
];

// إنشاء Variant
exports.createVariantValidation = [
  body("priceCents")
    .notEmpty()
    .withMessage("السعر مطلوب")
    .isInt({ min: 0 })
    .withMessage("السعر يجب أن يكون رقمًا موجبًا"),
  body("stockQty")
    .optional()
    .isInt({ min: 0 })
    .withMessage("المخزون يجب أن يكون 0 أو أكبر"),
  body("option1")
    .optional({ values: "falsy" })
    .isLength({ min: 1, max: 120 })
    .withMessage("الخيار الأول غير صالح"),
  body("option2")
    .optional({ values: "falsy" })
    .isLength({ min: 1, max: 120 })
    .withMessage("الخيار الثاني غير صالح"),
  body("sku")
    .optional()
    .isLength({ min: 1, max: 180 })
    .withMessage("SKU غير صالح"),
  body("barcode")
    .optional()
    .isLength({ min: 1, max: 120 })
    .withMessage("الباركود غير صالح"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  // سعر الشراء — null مسموح (لسه ما اتدخلش) عشان نعرف إن الربح غير معروف
  body("costCents")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage("سعر الشراء يجب أن يكون 0 أو أكبر"),
  body("supplierId")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("المورد غير صالح")
    .toInt(),
];

// تحديث Variant
exports.updateVariantValidation = [
  body("priceCents")
    .optional()
    .isInt({ min: 0 })
    .withMessage("السعر يجب أن يكون رقمًا موجبًا"),
  body("stockQty")
    .optional()
    .isInt({ min: 0 })
    .withMessage("المخزون يجب أن يكون 0 أو أكبر"),
  body("option1")
    .optional({ values: "falsy" })
    .isLength({ min: 1, max: 120 })
    .withMessage("الخيار الأول غير صالح"),
  body("option2")
    .optional({ values: "falsy" })
    .isLength({ min: 1, max: 120 })
    .withMessage("الخيار الثاني غير صالح"),
  body("sku")
    .optional()
    .isLength({ min: 1, max: 180 })
    .withMessage("SKU غير صالح"),
  body("barcode")
    .optional()
    .isLength({ min: 1, max: 120 })
    .withMessage("الباركود غير صالح"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("costCents")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage("سعر الشراء يجب أن يكون 0 أو أكبر"),
  body("supplierId")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("المورد غير صالح")
    .toInt(),
];

// ضبط مخزون (زيادة/نقصان)
exports.adjustStockValidation = [
  body("delta")
    .isInt()
    .withMessage("قيمة التعديل يجب أن تكون رقمًا صحيحًا (موجب أو سالب)")
    .notEmpty()
    .withMessage("قيمة التعديل مطلوبة"),
];

// :productId في المسار
// exports.productIdParamValidation = [
//   param("productId").isInt({ gt: 0 }).withMessage("معرّف المنتج غير صالح"),
// ];

// لائحة Variants لمنتج معيّن
// exports.variantListQueryValidation = [
//   query("isActive")
//     .optional()
//     .isBoolean()
//     .withMessage("قيمة isActive غير صحيحة"),
//   query("page").optional().isInt({ gt: 0 }).withMessage("رقم الصفحة غير صالح"),
//   query("limit")
//     .optional()
//     .isInt({ gt: 0, lt: 101 })
//     .withMessage("الحد يجب أن يكون بين 1 و 100"),
//   query("sortBy")
//     .optional()
//     .isIn(["createdAt", "priceCents", "stockQty"])
//     .withMessage("حقل الترتيب غير مدعوم"),
//   query("order")
//     .optional()
//     .isIn(["asc", "desc"])
//     .withMessage("اتجاه الترتيب غير صالح"),
// ];

// ======================= Cart =======================

exports.addCartItemValidation = [
  body("variantId").isInt({ gt: 0 }).withMessage("معرّف المتغير غير صالح"),
  body("qty").isInt({ gt: 0 }).withMessage("الكمية يجب أن تكون عددًا موجبًا"),
];

exports.updateCartItemValidation = [
  param("itemId").isInt({ gt: 0 }).withMessage("معرّف العنصر غير صالح"),
  body("qty").isInt({ gt: 0 }).withMessage("الكمية يجب أن تكون عددًا موجبًا"),
];

exports.removeCartItemParamValidation = [
  param("itemId").isInt({ gt: 0 }).withMessage("معرّف العنصر غير صالح"),
];

// ======================= Order =======================

exports.createOrderValidation = [
  body("shippingName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("اسم المستلم يجب أن يكون بين 2 و 100 حرف")
    .notEmpty()
    .withMessage("اسم المستلم مطلوب"),
  body("shippingPhone")
    .matches(phoneRegex)
    .withMessage("صيغة رقم الهاتف غير صحيحة")
    .trim()
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب"),
  body("shippingAddress")
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage("العنوان يجب أن يكون بين 2 و 500 حرف")
    .notEmpty()
    .withMessage("العنوان مطلوب"),
  // المدينة/المنطقة اختياريين مؤقتاً (الطلبات القديمة ما عندهاش)،
  // بس لو بعتهم لازم يكونوا أرقام صحيحة. التحقق من إن المنطقة فعلاً
  // تابعة للمدينة يعمل في الـ controller لأنه محتاج query.
  body("deliveryCityId").optional({ nullable: true, checkFalsy: true }).isInt({ gt: 0 }).withMessage("المدينة غير صالحة").toInt(),
  body("deliveryAreaId").optional({ nullable: true, checkFalsy: true }).isInt({ gt: 0 }).withMessage("المنطقة غير صالحة").toInt(),
];

// التحقق إن المنطقة تابعة للمدينة — بيشتغل جوّه transaction
// (bypass)، ما يمكنش يتحط في express-validator
exports.validateAreaBelongsToCity = async (deliveryCityId, deliveryAreaId) => {
  if (!deliveryAreaId) return { ok: true };
  const area = await prisma.area.findUnique({
    where: { id: deliveryAreaId },
    include: { city: { select: { isActive: true } } },
  });
  if (!area) return { ok: false, message: "المنطقة المختارة غير موجودة" };
  if (deliveryCityId && area.cityId !== deliveryCityId) {
    return { ok: false, message: "المنطقة المختارة لا تتبع المدينة المختارة" };
  }
  return { ok: true, area };
};

exports.orderIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
];
exports.deleteOrderValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
];

// تحديث الطلب من قبل المستخدم
exports.updateOrderValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
  body("shippingName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("اسم المستلم يجب أن يكون بين 2 و 100 حرف"),
  body("shippingPhone")
    .optional()
    .matches(phoneRegex)
    .withMessage("صيغة رقم الهاتف غير صحيحة"),
  body("shippingAddress")
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("العنوان يجب أن يكون بين 10 و 500 حرف"),
  // هنا يبقا null مسموح (يعني شيل المنطقة) — لـ .optional().isInt() مش هيمسك null
  body("deliveryCityId")
    .optional({ nullable: true })
    .custom((v) => v === null || /^\d+$/.test(String(v)))
    .withMessage("المدينة غير صالحة")
    .toInt(),
  body("deliveryAreaId")
    .optional({ nullable: true })
    .custom((v) => v === null || /^\d+$/.test(String(v)))
    .withMessage("المنطقة غير صالحة")
    .toInt(),
];

// تحديث الطلب من قبل الأدمن
exports.updateOrderStatusValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
  body("status")
    // PARTIALLY_DELIVERED في القائمة باش يوصل للـ controller ويجيب رسالة مفهومة
    .isIn(["PENDING", "CONFIRMED", "SHIPPING", "PARTIALLY_DELIVERED", "DELIVERED", "CANCELLED"])
    .withMessage("حالة الطلب غير صالحة"),
  body("cancelledReason")
    .optional()
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage("سبب الإلغاء يجب أن يكون بين 2 و 500 حرف"),
];

// إلغاء الطلب من قبل المستخدم
exports.cancelOrderValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
  body("reason")
    .optional()
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage("سبب الإلغاء يجب أن يكون بين 2 و 500 حرف"),
];

// تصفية الطلبات للأدمن
// exports.adminOrdersQueryValidation = [
//   query("status")
//     .optional()
//     .isIn(["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"])
//     .withMessage("حالة الطلب غير صالحة"),
//   query("page").optional().isInt({ gt: 0 }).withMessage("رقم الصفحة غير صالح"),
//   query("limit").optional().isInt({ gt: 0, lt: 101 }).withMessage("الحد يجب أن يكون بين 1 و 100"),
//   query("search").optional().isString().withMessage("نص البحث غير صالح"),
//   query("startDate").optional().isISO8601().withMessage("تاريخ البداية غير صالح"),
//   query("endDate").optional().isISO8601().withMessage("تاريخ النهاية غير صالح")
// ];

// ======================= Wishlist =======================
exports.wishlistItemValidation = [
  body("productId")
    .isInt({ gt: 0 })
    .withMessage("معرّف المنتج غير صالح")
    .notEmpty()
    .withMessage("معرّف المنتج مطلوب"),
];

exports.wishlistItemIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف العنصر غير صالح"),
];

// ======================= Notifications =======================
exports.createNotificationValidation = [
  body("type")
    .isIn([
      "ORDER_CREATED",
      "ORDER_CONFIRMED",
      "ORDER_SHIPPED",
      "ORDER_DELIVERED",
      "ORDER_CANCELLED",
      "LOW_STOCK",
      "PROMOTIONAL",
      "SYSTEM",
    ])
    .withMessage("نوع الإشعار غير صالح"),
  body("title")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("عنوان الإشعار يجب أن يكون بين 2 و 100 حرف")
    .notEmpty()
    .withMessage("عنوان الإشعار مطلوب"),
  body("body")
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage("محتوى الإشعار يجب أن يكون بين 2 و 500 حرف")
    .notEmpty()
    .withMessage("محتوى الإشعار مطلوب"),
  body("userId")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("معرّف المستخدم غير صالح"),
  body("data")
    .optional()
    .isObject()
    .withMessage("البيانات الإضافية يجب أن تكون كائن"),
];

exports.notificationIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف الإشعار غير صالح"),
];

exports.markAsReadValidation = [
  body("notificationIds")
    .isArray()
    .withMessage("قائمة معرّفات الإشعارات يجب أن تكون مصفوفة")
    .notEmpty()
    .withMessage("معرّفات الإشعارات مطلوبة"),
  body("notificationIds.*")
    .isInt({ gt: 0 })
    .withMessage("معرّف الإشعار غير صالح"),
];

// تسجيل/إلغاء تسجيل توكن جهاز
exports.registerDeviceValidation = [
  body("token").isString().trim().notEmpty().withMessage("token مطلوب"),
  body("platform")
    .optional()
    .isIn(["android", "ios", "web"])
    .withMessage("منصة غير صالحة"),
  // body("lang")
  //   .optional()
  //   .isString()
  //   .isLength({ min: 2, max: 5 })
  //   .withMessage("لغة غير صالحة"),
];

exports.deviceTokenParamValidation = [
  param("token").isString().trim().notEmpty().withMessage("token غير صالح"),
];

// ======================= Offers =======================

// حقول اختيارية: نقبل null و "" لأن الواجهة ممكن تبعتهم فاضي
const optionalOffer = () => ({ nullable: true, checkFalsy: true });

// الواجهة بترفع الصورة بـ multipart/form-data، فـ `isActive` بيوصل نص "true"/"false"
// مش Boolean فعلي، و`isBoolean()` الصارم كان بيرفضها بـ 422. فبنقبل النص ونحوّله.
const offerActiveChain = (field) =>
  body(field)
    .optional(optionalOffer())
    .isIn(["true", "false", true, false])
    .withMessage("حالة التفعيل غير صحيحة")
    .toBoolean();

// العرض = بانر للعرض فقط: عنوان + وصف + صورة + تواريخ.
// مفيش خصم ولا هدف (منتجات/تصنيفات/ماركات).
exports.createOfferValidation = [
  body("title")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("عنوان العرض يجب أن يكون بين 2 و 100 حرف")
    .notEmpty()
    .withMessage("عنوان العرض مطلوب"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("الوصف يجب ألا يتجاوز 500 حرف"),
  body("startDate").isISO8601().withMessage("تاريخ البداية غير صالح"),
  body("endDate").isISO8601().withMessage("تاريخ النهاية غير صالح"),
  offerActiveChain("isActive"),
  body("displayOrder")
    .optional(optionalOffer())
    .isInt({ min: 0 })
    .withMessage("ترتيب العرض يجب أن يكون رقم موجب"),
  body().custom((value) => {
    if (
      value.startDate &&
      value.endDate &&
      new Date(value.startDate) >= new Date(value.endDate)
    ) {
      throw new Error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    }
    return true;
  }),
];


exports.updateOfferValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف العرض غير صالح"),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("عنوان العرض يجب أن يكون بين 2 و 100 حرف"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("الوصف يجب ألا يتجاوز 500 حرف"),
  body("startDate")
    .optional(optionalOffer())
    .isISO8601()
    .withMessage("تاريخ البداية غير صالح"),
  body("endDate")
    .optional(optionalOffer())
    .isISO8601()
    .withMessage("تاريخ النهاية غير صالح"),
  offerActiveChain("isActive"),
  body("displayOrder")
    .optional(optionalOffer())
    .isInt({ min: 0 })
    .withMessage("ترتيب العرض يجب أن يكون رقم موجب"),
];


exports.offerIdParamValidation = [

  param("id").isInt({ gt: 0 }).withMessage("معرّف العرض غير صالح"),
];

// ======================= Users =======================

exports.userIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف المستخدم غير صالح"),
];

exports.updateUserValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف المستخدم غير صالح"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("الاسم يجب أن يكون بين 2 و 50 حرفًا"),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("صيغة البريد الإلكتروني غير صحيحة"),
  body("phone")
    .optional()
    .matches(phoneRegex)
    .withMessage("صيغة رقم الهاتف غير صحيحة"),
  // body("role")
  //   .optional()
  //   .isIn(["ADMIN", "CUSTOMER"])
  //   .withMessage("الدور غير صالح"),
];

exports.updateUserRoleValidation = [
  param("id").isInt({ gt: 0 }).withMessage("معرّف المستخدم غير صالح"),
  body("role")
    .trim()
    .notEmpty()
    .withMessage("الدور مطلوب")
    .isIn(["ADMIN", "CUSTOMER", "DELIVERY"])
    .withMessage("الدور غير صالح"),
];

// exports.adminUsersQueryValidation = [
//   query("page").optional().isInt({ gt: 0 }).withMessage("رقم الصفحة غير صالح"),
//   query("limit").optional().isInt({ gt: 0, lt: 101 }).withMessage("الحد يجب أن يكون بين 1 و 100"),
//   query("role").optional().isIn(["ADMIN", "CUSTOMER"]).withMessage("الدور غير صالح"),
//   query("search").optional().isString().withMessage("نص البحث غير صالح"),
// ];

// ======================= Reports =======================
exports.reportsQueryValidation = [
  query("from")
    .optional()
    .isISO8601()
    .withMessage("صيغة تاريخ البداية غير صحيحة"),
  query("to")
    .optional()
    .isISO8601()
    .withMessage("صيغة تاريخ النهاية غير صحيحة"),
  query("granularity")
    .optional()
    .isIn(["day", "week", "month"])
    .withMessage("وحدة التجميع يجب أن تكون day أو week أو month"),
  query("type")
    .optional()
    .isIn(["sales", "products", "orders"])
    .withMessage("نوع التقرير غير صالح"),
  query("format")
    .optional()
    .isIn(["csv", "pdf"])
    .withMessage("صيغة التصدير يجب أن تكون csv أو pdf"),
  query("limit")
    .optional()
    .isInt({ gt: 0, lt: 101 })
    .withMessage("الحد يجب أن يكون بين 1 و 100"),
];

// ======================= Delivery =======================
exports.assignmentIdParamValidation = [
  param("assignmentId")
    .isInt({ gt: 0 })
    .withMessage("معرّف المهمة غير صالح"),
];

exports.assignDeliveryValidation = [
  body("orderId").isInt({ gt: 0 }).withMessage("معرّف الطلب غير صالح"),
  body("deliveryId").isInt({ gt: 0 }).withMessage("معرّف المندوب غير صالح"),
  body("note").optional().trim().isLength({ max: 200 }).withMessage("الملاحظة طويلة جداً"),
];

// ---------- Phase 4: التسليم الجزئي ----------
// بنود التسليم: كل بند لازم ياخد orderItemId + الكمية المسلّمة.
// الكمية الراجعة بنحسبها الباج اند (qty - deliveredQty) — ما نثقش في رقم
// المندوب للرجوع، عشان ما يقدرش يخفّي كمية ويخلي المخزون ينزل.
exports.settleDeliveryValidation = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("لازم تبعت بنود التسليم")
    .bail(),
  body("items.*.orderItemId")
    .isInt({ gt: 0 })
    .withMessage("معرّف بند الطلب غير صالح")
    .bail(),
  body("items.*.deliveredQty")
    .isInt({ min: 0 })
    .withMessage("الكمية المسلّمة لازم تكون رقم صحيح (0 أو أكثر)")
    .bail(),
  // collectedCents اختياري: لو المرسل حطه بنتحقق، ولو ما حطه الباج اند
  // بيحسبه من البنود المسلّمة (authoritative).
  body("collectedCents")
    .optional({ checkFalsy: false })
    .isInt({ min: 0 })
    .withMessage("المبلغ المقبوض لازم يكون رقم صحيح (0 أو أكثر)"),
  body("returnReason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("سبب الرجوع طويل جداً (500 حرف أقصى)"),
];

// ======================= الموردون =======================
exports.createSupplierValidation = [
  body("name").trim().notEmpty().withMessage("اسم المورد مطلوب").isLength({ max: 120 }).withMessage("اسم المورد طويل جداً"),
  body("phone").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 40 }).withMessage("رقم الهاتف غير صالح"),
  body("email").optional({ nullable: true, checkFalsy: true }).trim().isEmail().withMessage("البريد الإلكتروني غير صالح"),
  body("address").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 300 }).withMessage("العنوان غير صالح"),
  body("notes").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 1000 }).withMessage("الملاحظات غير صالحة"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
];

exports.updateSupplierValidation = [
  body("name").optional().trim().notEmpty().withMessage("اسم المورد مطلوب").isLength({ max: 120 }).withMessage("اسم المورد طويل جداً"),
  body("phone").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 40 }).withMessage("رقم الهاتف غير صالح"),
  body("email").optional({ nullable: true, checkFalsy: true }).trim().isEmail().withMessage("البريد الإلكتروني غير صالح"),
  body("address").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 300 }).withMessage("العنوان غير صالح"),
  body("notes").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 1000 }).withMessage("الملاحظات غير صالحة"),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
];

exports.supplierIdParamValidation = [
  param("id").isInt({ gt: 0 }).withMessage("المعرف غير صالح").toInt(),
];

// ======================= المدن والمناطق =======================
exports.createCityValidation = [
  body("name").trim().notEmpty().withMessage("اسم المدينة مطلوب").isLength({ max: 80 }).withMessage("اسم المدينة طويل جداً"),
  body("code").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 10 }).withMessage("الكود طويل جداً"),
  body("deliveryFeeCents").optional().isInt({ min: 0 }).withMessage("رسوم التوصيل غير صالحة").toInt(),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("sortOrder").optional().isInt().withMessage("ترتيب العرض غير صحيح").toInt(),
];

exports.updateCityValidation = [
  body("name").optional().trim().notEmpty().withMessage("اسم المدينة مطلوب").isLength({ max: 80 }).withMessage("اسم المدينة طويل جداً"),
  body("code").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 10 }).withMessage("الكود طويل جداً"),
  body("deliveryFeeCents").optional().isInt({ min: 0 }).withMessage("رسوم التوصيل غير صالحة").toInt(),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("sortOrder").optional().isInt().withMessage("ترتيب العرض غير صحيح").toInt(),
];

exports.createAreaValidation = [
  body("name").trim().notEmpty().withMessage("اسم المنطقة مطلوب").isLength({ max: 80 }).withMessage("اسم المنطقة طويل جداً"),
  body("cityId").isInt({ gt: 0 }).withMessage("المدينة غير صالحة").toInt(),
  body("deliveryFeeCents").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage("رسوم التوصيل غير صالحة").toInt(),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("sortOrder").optional().isInt().withMessage("ترتيب العرض غير صحيح").toInt(),
];

exports.updateAreaValidation = [
  body("name").optional().trim().notEmpty().withMessage("اسم المنطقة مطلوب").isLength({ max: 80 }).withMessage("اسم المنطقة طويل جداً"),
  body("cityId").optional().isInt({ gt: 0 }).withMessage("المدينة غير صالحة").toInt(),
  body("deliveryFeeCents").optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).withMessage("رسوم التوصيل غير صالحة").toInt(),
  body("isActive").optional().isBoolean().withMessage("قيمة التفعيل غير صحيحة"),
  body("sortOrder").optional().isInt().withMessage("ترتيب العرض غير صحيح").toInt(),
];

exports.quoteFeeValidation = [
  body("areaId").isInt({ gt: 0 }).withMessage("المنطقة غير صالحة").toInt(),
];

// ======================= محفظة المندوب =======================
exports.courierIdParamValidation = [
  param("courierId").isInt({ gt: 0 }).withMessage("معرّف المندوب غير صالح"),
];

exports.settleWalletValidation = [
  body("amountCents").isInt({ gt: 0 }).withMessage("مبلغ السحب لازم يكون رقم صحيح أكبر من صفر").toInt(),
  body("method").optional().trim().isLength({ max: 120 }).withMessage("طريقة الصرف طويلة جداً"),
  body("note").optional().trim().isLength({ max: 300 }).withMessage("الملاحظة طويلة جداً"),
];

exports.adjustWalletValidation = [
  body("amountCents").isInt({ gt: 0 }).withMessage("المبلغ لازم يكون رقم صحيح أكبر من صفر").toInt(),
  body("direction").isIn(["ADD", "REMOVE"]).withMessage("الاتجاه لازم يكون ADD أو REMOVE"),
  body("note").optional().trim().isLength({ max: 300 }).withMessage("الملاحظة طويلة جداً"),
];
