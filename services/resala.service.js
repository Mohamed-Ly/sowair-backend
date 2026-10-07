// services/resala.service.js
// عميل خدمات "رسالة" (Resala) لإرسال رموز التحقق والرسائل عبر SMS
const BASE_URL = process.env.RESALA_BASE_URL || "https://dev.resala.ly/api/v1";
const API_TOKEN = process.env.RESALA_API_TOKEN;
const SERVICE_NAME = process.env.RESALA_SERVICE_NAME || "Sowair";
const TEST_MODE =
  String(process.env.RESALA_TEST_MODE ?? "true").toLowerCase() === "true";

// رسائل مفهومة لأخطاء Resala المألوفة (بدون كشف القيم)
const RESALA_ERROR_MESSAGES = {
  401: "توكن مزود الرسائل غير صالح — راجع RESALA_API_TOKEN",
  403: "لا تملك صلاحية استخدام حساب رسالة — راجع حسابك لدى المزود",
  422: "بيانات الطلب مرفوضة لدى مزود الرسائل",
  400: "مزود الرسائل رفض الطلب (غالباً رصيد غير كافٍ)",
};

// توحيد صيغة الرقم: يقبل "0912345678" و"+218912345678" و"218912345678"
// ويعيد "218912345678" (كما يفترضه مزود Resala)
function normalizePhone(phone) {
  let p = String(phone || "").replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (!p.startsWith("218")) p = "218" + p.replace(/^0/, "");
  return p;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = "GET", body = null, query = {} } = {}) {
  if (!API_TOKEN) {
    const e = new Error("RESALA_API_TOKEN غير مهيّأ — أضفه في ملف .env");
    e.status = 500;
    throw e;
  }

  const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== false) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.href, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // الرد ليس JSON (نادراً) — نتعامل معه كفشل
  }

  if (!res.ok) {
    const e = new Error(
      RESALA_ERROR_MESSAGES[res.status] ||
        `فشل الاتصال بمزود الرسائل (${res.status})`
    );
    e.status = res.status >= 500 ? 502 : res.status;
    e.code = "RESALA_ERROR";
    e.details = data;
    throw e;
  }
  return data;
}

// إرسال رمز تحقق عبر POST /pins — يعيد كود الرمز (لنقارنه محلياً)
async function sendOtp(phone, { pinLength = 6, autofill } = {}) {
  return request("/pins", {
    method: "POST",
    body: { phone: normalizePhone(phone) },
    query: {
      test: TEST_MODE,
      len: pinLength,
      service_name: SERVICE_NAME,
      ...(autofill ? { autofill } : {}),
    },
  });
}

// إرسال رسالة من قالب معرّف مسبقاً
async function sendTemplate(templateId, records) {
  return request(`/messages/send-template?sms_template_id=${templateId}`, {
    method: "POST",
    body: { records },
  });
}

// فحص الرسائل المرسلة — GET فقط، مع retry خفيف.
// لا نعيد إرسال POST أبداً (لتجنب إرسال رسائل مكررة تستهلك رصيد).
async function getSentView({ page = 1, paginate = 10, filters = "", status = "" } = {}) {
  const query = { page, paginate, sorts: "-created_at" };
  if (filters) query.filters = filters;
  if (status) query.status = status;

  let attempts = 0;
  for (;;) {
    try {
      return await request("/sent-view", { query });
    } catch (e) {
      attempts += 1;
      if (attempts > 2) throw e;
      await sleep(250 * 2 ** attempts);
    }
  }
}

module.exports = {
  normalizePhone,
  sendOtp,
  sendTemplate,
  getSentView,
  TEST_MODE,
};