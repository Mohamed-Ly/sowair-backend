// prisma/createAdmin.js
// إنشاء/تحديث حساب أدمن واحد فقط دون مسح أي بيانات.
// الاستخدام:
//   ADMIN_PHONE="0910000000" ADMIN_PASSWORD="StrongPass" \
//   ADMIN_NAME="مدير سوير" ADMIN_EMAIL="admin@sowair.ly" \
//   node prisma/createAdmin.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const name = process.env.ADMIN_NAME || "مدير سوير";
const phone = (process.env.ADMIN_PHONE || "").trim();
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase() || null;
const password = process.env.ADMIN_PASSWORD || "";

async function main() {
  if (!phone) {
    throw new Error("ADMIN_PHONE مطلوب (رقم هاتف الأدمن)");
  }
  if (!password || password.length < 6) {
    throw new Error("ADMIN_PASSWORD مطلوب (6 أحرف على الأقل)");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({
    where: email ? { OR: [{ phone }, { email }] } : { phone },
  });

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: { name, phone, email, password: passwordHash, role: "ADMIN" },
    });
    console.log("♻️  تم تحديث حساب الأدمن الموجود (بدون مسح أي بيانات)");
  } else {
    user = await prisma.user.create({
      data: { name, phone, email, password: passwordHash, role: "ADMIN" },
    });
    console.log("✅ تم إنشاء حساب الأدمن");
  }

  console.log(`   id=${user.id}  phone=${user.phone}  email=${user.email || "-"}  role=${user.role}`);
}

main()
  .catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
