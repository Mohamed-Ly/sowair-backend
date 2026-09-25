// prisma/seed.js — بيانات تجريبية شاملة للمتجر متعدد المنتجات
// التشغيل: npx prisma db seed
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const slugify = require("../utils/slugify");

const prisma = new PrismaClient();

const PASSWORD = "12345678";
const daysAgo = (n, hourOffset = 0) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(10 + hourOffset, (n * 7) % 60, 0, 0);
  return d;
};

async function resetDatabase() {
  console.log("🧹 تنظيف قاعدة البيانات...");
  await prisma.deviceToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.deliveryAssignment.deleteMany();
  await prisma.orderStatusLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.offerProduct.deleteMany();
  await prisma.offerCategory.deleteMany();
  await prisma.offerBrand.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ تم التنظيف");
}

// ======================= التصنيفات =======================
const CATEGORY_TREE = [
  {
    name: "ملابس",
    slug: "clothes",
    image: "/uploads/006820c888eed37f6dc6c3b871d2e7e2.jpg",
    children: [
      { name: "ملابس رجالية", slug: "men-clothes", image: "/uploads/024c01024e8b8bf383d941a9240ad16c.jpg" },
      { name: "ملابس نسائية", slug: "women-clothes", image: "/uploads/083538391f48f9ab16b5c5f3124fbeae.jpg" },
      { name: "ملابس أطفال", slug: "kids-clothes", image: "/uploads/0d4e392fa2fec12dbda1ebc50d381470.jpg" },
    ],
  },
  {
    name: "إكسسوارات",
    slug: "accessories",
    image: "/uploads/11c42c93092ff578eecdc8e99809eee0.jpg",
    children: [
      { name: "ساعات", slug: "watches", image: "/uploads/124ee8178974cbeadc02354801abf40a.jpg" },
      { name: "حقائب", slug: "bags", image: "/uploads/179f3db51b182503efefa9c072d58215.jpg" },
      { name: "مجوهرات", slug: "jewelry", image: "/uploads/1e230f43fe4c885de274f78baea185ea.jpg" },
    ],
  },
  {
    name: "مكياج وعناية",
    slug: "makeup",
    image: "/uploads/1f92bdcdd9bac387ad786c914075266e.jpg",
    children: [
      { name: "مكياج الوجه", slug: "face-makeup", image: "/uploads/24292e2bf3efdeb6c6e908284cadbd20.jpg" },
      { name: "مكياج العيون", slug: "eye-makeup", image: "/uploads/293195a3aa9eb413161f49da1760f626.jpg" },
      { name: "العناية بالبشرة", slug: "skincare", image: "/uploads/2bbcd41e0e49bd09bab6b663788414cb.jpg" },
    ],
  },
  {
    name: "إلكترونيات",
    slug: "electronics",
    image: "/uploads/341835f8d54a8ff671c8015deaaae4bb.jpg",
    children: [
      { name: "هواتف محمولة", slug: "smartphones", image: "/uploads/35a64ab9093357c11fb57e729d38fc03.jpg" },
      { name: "حواسيب وأجهزة محمولة", slug: "computers-laptops", image: "/uploads/3aef0b619a7a800776407b9cb7842af9.jpg" },
      { name: "أجهزة منزلية", slug: "home-appliances", image: "/uploads/3d93da1d20a15f219cdcd851fce50bb7.jpg" },
      { name: "سماعات وتقنية", slug: "audio-tech", image: "/uploads/3fb9b1901f1310e71d0c7a8cdcab4131.jpg" },
    ],
  },
  {
    name: "عطور",
    slug: "perfumes",
    image: "/uploads/405a951922d59833c0fa8cab47f194e0.jpg",
    children: [
      { name: "عطور رجالية", slug: "men-perfumes", image: "/uploads/43a6113ed83b83cab21d1dd6e5d21ab3.jpg" },
      { name: "عطور نسائية", slug: "women-perfumes", image: "/uploads/501726385f144cee2a935b73a5ac11c7.jpg" },
    ],
  },
];

async function seedCategories() {
  async function upsertTree(nodes, parentId = null) {
    for (const node of nodes) {
      const { children, image, ...fields } = node;
      const category = await prisma.category.upsert({
        where: { slug: node.slug },
        update: { name: node.name, parentId, image: node.image ?? null },
        create: { name: node.name, slug: node.slug || slugify(node.name), parentId, image: node.image ?? null },
      });
      if (node.children && node.children.length) {
        await upsertTree(node.children, category.id);
      }
    }
  }
  await upsertTree(CATEGORY_TREE);
  return prisma.category.findMany();
}

// ======================= المستخدمون =======================
async function seedUsers() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const people = [
    // أدمن
    { name: "م. محمد", email: "admin@test.com", phone: "0900000001", role: "ADMIN" },
    { name: "سارة المديرة", email: "sarah@test.com", phone: "0900000002", role: "ADMIN" },
    // مندوبون
    { name: "علي المندوب", email: "deli1@test.com", phone: "0921111111", role: "DELIVERY" },
    { name: "موسى المندوب", email: "deli2@test.com", phone: "0922222222", role: "DELIVERY" },
    { name: "هدى المندوبة", email: "deli3@test.com", phone: "0923333333", role: "DELIVERY" },
    // عملاء
    { name: "أحمد العائش", email: "customer1@test.com", phone: "0911111111", role: "CUSTOMER" },
    { name: "فاطمة خالد", email: "customer2@test.com", phone: "0912222222", role: "CUSTOMER" },
    { name: "محمد يوسف", email: "customer3@test.com", phone: "0913333333", role: "CUSTOMER" },
    { name: "ليلى إبراهيم", email: "customer4@test.com", phone: "0914444444", role: "CUSTOMER" },
    { name: "يوسف صالح", email: "customer5@test.com", phone: "0915555555", role: "CUSTOMER" },
    { name: "أمل ناصر", email: "customer6@test.com", phone: "0916666666", role: "CUSTOMER" },
    { name: "خالد عبدالله", email: "customer7@test.com", phone: "0917777777", role: "CUSTOMER" },
    { name: "نور سعيد", email: "customer8@test.com", phone: "0918888888", role: "CUSTOMER" },
  ];

  const users = {};
  for (const p of people) {
    const user = await prisma.user.create({ data: { ...p, password: hash } });
    users[p.role] = users[p.role] || [];
    users[p.role].push(user);
  }
  return users;
}

// ======================= الماركات =======================
// ======================= المنتجات =======================
const BRANDS = [
  { name: "Nike", slug: "nike", country: "الولايات المتحدة", image: "/uploads/535431aabbbdbe51dc4fc8c2bf0ac367.jpg" },
  { name: "Adidas", slug: "adidas", country: "ألمانيا", image: "/uploads/555b90ceb65d489e80e247121771da18.jpg" },
  { name: "Apple", slug: "apple", country: "الولايات المتحدة", image: "/uploads/56a78629406a705de5efb22bb576130e.jpg" },
  { name: "Samsung", slug: "samsung", country: "كوريا الجنوبية", image: "/uploads/5a451abbb7de01d52230a9d9f859a96e.jpg" },
  { name: "Sony", slug: "sony", country: "اليابان", image: "/uploads/643b8aa482baa770ef3f917b2e0da55f.jpg" },
  { name: "L'Oréal", slug: "loreal", country: "فرنسا", image: "/uploads/64fc7f71f624a291d6518fd860559f53.jpg" },
  { name: "Dior", slug: "dior", country: "فرنسا", image: "/uploads/664da608fba6392b4a0da2bf0a07be23.jpg" },
  { name: "Gucci", slug: "gucci", country: "إيطاليا", image: "/uploads/6c28de858ee530cb3a251765dd77a23a.jpg" },
];

const PRODUCTS = [
  {
    name: "قميص رجالي كلاسيكي",
    slug: "classic-mens-shirt",
    brand: "Adidas",
    categorySlug: "men-clothes",
    description: "قميص قطني كلاسيكي بأزرار أمامية وقصة عصرية مريحة.",
    variants: [
      { option1: "M", option2: "أبيض", priceCents: 29900, stockQty: 40, sku: "SH-M-W" },
      { option1: "L", option2: "أبيض", priceCents: 29900, stockQty: 35, sku: "SH-L-W" },
      { option1: "XL", option2: "أزرق", priceCents: 31500, stockQty: 20, sku: "SH-XL-B" },
      { option1: "2XL", option2: "أسود", priceCents: 31500, stockQty: 12, sku: "SH-2XL-K" },
    ],
  },
  {
    name: "فستان نسائي سهرة",
    slug: "women-party-dress",
    brand: "Dior",
    categorySlug: "women-clothes",
    description: "فستان سهرة أنيق بتصميم راقٍ وخامة فاخرة.",
    variants: [
      { option1: "S", option2: "بورجندي", priceCents: 49900, stockQty: 15, sku: "DR-S-BG" },
      { option1: "M", option2: "بورجندي", priceCents: 49900, stockQty: 18, sku: "DR-M-BG" },
      { option1: "L", option2: "أسود", priceCents: 52500, stockQty: 10, sku: "DR-L-K" },
    ],
  },
  {
    name: "طقم أطفال كاجوال",
    slug: "kids-casual-set",
    brand: "Nike",
    categorySlug: "kids-clothes",
    description: "طقم أطفال قطني مريح مناسب للاستخدام اليومي.",
    variants: [
      { option1: "4 سنوات", option2: "رمادي", priceCents: 24900, stockQty: 25, sku: "KID-4-GY" },
      { option1: "6 سنوات", option2: "رمادي", priceCents: 24900, stockQty: 22, sku: "KID-6-GY" },
      { option1: "8 سنوات", option2: "أزرق", priceCents: 25900, stockQty: 16, sku: "KID-8-B" },
    ],
  },
  {
    name: "ساعة يد كاجوال",
    slug: "casual-watch",
    brand: "Gucci",
    categorySlug: "watches",
    description: "ساعة يد بميناء أنيق وهيكل فولاذي مقاوم للماء.",
    variants: [
      { option1: "رجالي", option2: "فولاذ", priceCents: 199000, stockQty: 6, sku: "WT-M-ST" },
      { option1: "نسائي", option2: "ذهبي", priceCents: 219000, stockQty: 8, sku: "WT-F-GD" },
    ],
  },
  {
    name: "حقيبة يد نسائية",
    slug: "ladies-handbag",
    brand: "Gucci",
    categorySlug: "bags",
    description: "حقيبة يد جلدية فاخرة بسعة مناسبة وحزام قابل للتعديل.",
    variants: [
      { option1: "صغيرة", option2: "بيج", priceCents: 349000, stockQty: 5, sku: "BG-S-BG" },
      { option1: "كبيرة", option2: "بيج", priceCents: 389000, stockQty: 4, sku: "BG-L-BG" },
      { option1: "متوسطة", option2: "أسود", priceCents: 369000, stockQty: 6, sku: "BG-M-K" },
    ],
  },
  {
    name: "خاتم فضة مطلي",
    slug: "silver-ring",
    brand: "Gucci",
    categorySlug: "jewelry",
    description: "خاتم فضة مطلي بالذهب مع نقشة عصرية.",
    variants: [
      { option1: "مقاس 18", priceCents: 89000, stockQty: 12, sku: "RG-18" },
      { option1: "مقاس 19", priceCents: 89000, stockQty: 10, sku: "RG-19" },
      { option1: "مقاس 20", priceCents: 89000, stockQty: 9, sku: "RG-20" },
    ],
  },
  {
    name: "كريم أساس سائل",
    slug: "liquid-foundation",
    brand: "L'Oréal",
    categorySlug: "face-makeup",
    description: "كريم أساس بتركيبة خفيفة وتغطية متوسطة تدوم طويلاً.",
    variants: [
      { option1: "ظل فاتح", option2: "30 مل", priceCents: 9500, stockQty: 50, sku: "FND-LT" },
      { option1: "ظل متوسط", option2: "30 مل", priceCents: 9500, stockQty: 45, sku: "FND-MD" },
      { option1: "ظل داكن", option2: "30 مل", priceCents: 9500, stockQty: 38, sku: "FND-DK" },
    ],
  },
  {
    name: "مجموعة مكياج العيون",
    slug: "eyes-makeup-set",
    brand: "L'Oréal",
    categorySlug: "eye-makeup",
    description: "مجموعة شاملة لظلال العيون والماسكارا والأيلاينر.",
    variants: [
      { option1: "ألوان دافئة", priceCents: 14500, stockQty: 30, sku: "EYE-WARM" },
      { option1: "ألوان باردة", priceCents: 14500, stockQty: 28, sku: "EYE-COOL" },
    ],
  },
  {
    name: "سيروم فيتامين سي",
    slug: "vitamin-c-serum",
    brand: "L'Oréal",
    categorySlug: "skincare",
    description: "سيروم مقوٍّ ومضيء للبشرة بفيتامين سي وبمضادات الأكسدة.",
    variants: [
      { option1: "30 مل", priceCents: 12000, stockQty: 60, sku: "SR-30" },
      { option1: "50 مل", priceCents: 17500, stockQty: 40, sku: "SR-50" },
    ],
  },
  {
    name: "هاتف ذكي",
    slug: "galaxy-smartphone",
    brand: "Samsung",
    categorySlug: "smartphones",
    description: "هاتف ذكي بشاشة كبيرة وكاميرا متطورة وبطارية تدوم طويلاً.",
    variants: [
      { option1: "128GB", option2: "أسود", priceCents: 249000, stockQty: 20, sku: "PH-128-K" },
      { option1: "256GB", option2: "أسود", priceCents: 289000, stockQty: 15, sku: "PH-256-K" },
      { option1: "256GB", option2: "أزرق", priceCents: 289000, stockQty: 12, sku: "PH-256-B" },
    ],
  },
  {
    name: "لابتوب احترافي",
    slug: "pro-laptop",
    brand: "Apple",
    categorySlug: "computers-laptops",
    description: "لابتوب احترافي بشريحة قوية وشاشة ريتينا عالية الدقة.",
    variants: [
      { option1: "شريحة M1", option2: "512GB", priceCents: 449000, stockQty: 8, sku: "LP-M1" },
      { option1: "شريحة M2", option2: "512GB", priceCents: 549000, stockQty: 5, sku: "LP-M2" },
    ],
  },
  {
    name: "مكنسة كهربائية",
    slug: "vacuum-cleaner",
    brand: "Samsung",
    categorySlug: "home-appliances",
    description: "مكنسة كهربائية قوية بشفط عالي وسلة كبيرة.",
    variants: [
      { option1: "كلاسيك", priceCents: 89900, stockQty: 10, sku: "VC-CL" },
      { option1: "روبوت", priceCents: 149900, stockQty: 6, sku: "VC-RB" },
    ],
  },
  {
    name: "سماعة بلوتوث",
    slug: "bluetooth-headphones",
    brand: "Sony",
    categorySlug: "audio-tech",
    description: "سماعة رأس لاسلكية مع عزل ضوضاء نشط وصوت نقي.",
    variants: [
      { option1: "أسود", priceCents: 27500, stockQty: 35, sku: "HP-K" },
      { option1: "فضي", priceCents: 27500, stockQty: 30, sku: "HP-SV" },
      { option1: "أزرق", priceCents: 27500, stockQty: 22, sku: "HP-B" },
    ],
  },
  {
    name: "سماعات لاسلكية",
    slug: "wireless-earbuds",
    brand: "Apple",
    categorySlug: "audio-tech",
    description: "سماعات داخلية لاسلكية مع علبة شحن متنقلة.",
    variants: [
      { option1: "جيل 2", priceCents: 54900, stockQty: 40, sku: "EB-2" },
      { option1: "جيل 3", priceCents: 64900, stockQty: 25, sku: "EB-3" },
    ],
  },
  {
    name: "عطر رجالي فاخر",
    slug: "luxury-mens-perfume",
    brand: "Dior",
    categorySlug: "men-perfumes",
    description: "عطر رجالي بتركيبة خشبية وحارة تدوم طويلاً.",
    variants: [
      { option1: "50 مل", option2: "EDP", priceCents: 32000, stockQty: 45, sku: "PF-M-50" },
      { option1: "100 مل", option2: "EDP", priceCents: 46000, stockQty: 30, sku: "PF-M-100" },
    ],
  },
  {
    name: "عطر نسائي فاخر",
    slug: "luxury-womens-perfume",
    brand: "Gucci",
    categorySlug: "women-perfumes",
    description: "عطر نسائي بنفحات زهرية دافئة ومميزة.",
    variants: [
      { option1: "50 مل", option2: "EDP", priceCents: 38500, stockQty: 38, sku: "PF-W-50" },
      { option1: "100 مل", option2: "EDP", priceCents: 52000, stockQty: 24, sku: "PF-W-100" },
    ],
  },
  {
    name: "تلفاز سمارت",
    slug: "smart-tv",
    brand: "Samsung",
    categorySlug: "home-appliances",
    description: "تلفاز سمارت بدقة 4K وذكاء اصطناعي لتحسين الصورة.",
    variants: [
      { option1: "43 بوصة", priceCents: 129900, stockQty: 9, sku: "TV-43" },
      { option1: "55 بوصة", priceCents: 189900, stockQty: 6, sku: "TV-55" },
    ],
  },
  {
    name: "ساعة أطفال ذكية",
    slug: "kids-smartwatch",
    brand: "Nike",
    categorySlug: "watches",
    description: "ساعة ذكية للأطفال مع GPS وتنبيهات مكالمات.",
    variants: [
      { option1: "أزرق", priceCents: 12900, stockQty: 25, sku: "KS-B" },
      { option1: "وردي", priceCents: 12900, stockQty: 20, sku: "KS-P" },
    ],
  },
  {
    name: "جاكيت رجالي جلدي",
    slug: "men-leather-jacket",
    brand: "Gucci",
    categorySlug: "men-clothes",
    description: "جاكيت جلدي رجالي أنيق بملمس فاخر.",
    variants: [
      { option1: "M", option2: "أسود", priceCents: 189000, stockQty: 7, sku: "JKT-M-K" },
      { option1: "L", option2: "أسود", priceCents: 189000, stockQty: 9, sku: "JKT-L-K" },
      { option1: "XL", option2: "بني", priceCents: 199000, stockQty: 5, sku: "JKT-XL-BR" },
    ],
  },
  {
    name: "طقم مكياج متكامل",
    slug: "complete-makeup-kit",
    brand: "L'Oréal",
    categorySlug: "face-makeup",
    description: "طقم مكياج متكامل يضم الأساس، أحمر الشفاه، والمحددات.",
    variants: [
      { option1: "طبيعي", priceCents: 19900, stockQty: 18, sku: "MK-N" },
      { option1: "سهرة", priceCents: 21900, stockQty: 14, sku: "MK-E" },
    ],
  },
];

async function seedCatalog() {
  const brands = {};
  const brandByName = {};
  for (const b of BRANDS) {
    const created = await prisma.brand.create({ data: b });
    brands[b.slug] = created;
    brandByName[b.name] = created;
  }

  const categories = await prisma.category.findMany();
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const variants = [];
  const products = [];

  for (const p of PRODUCTS) {
    const brand = brandByName[p.brand];
    const category = catBySlug[p.categorySlug];

    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description || null,
        brandId: brand.id,
        categoryId: category.id,
        isActive: true,
        images: {
          create: [
            { path: `/uploads/seed/${p.slug}-1.jpg`, isPrimary: true, sortOrder: 0 },
            { path: `/uploads/seed/${p.slug}-2.jpg`, isPrimary: false, sortOrder: 1 },
          ],
        },
        ProductCategory: {
          create: [{ categoryId: category.id }],
        },
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.create({
        data: { ...v, productId: product.id },
      });
      variants.push(variant);
    }
    products.push(product);
  }

  return { brands, products, variants };
}

// ======================= العروض =======================
async function seedOffers(products, brands, categories) {
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const offers = [
    {
      title: "خصم 15% على جميع المنتجات",
      description: "عرض لفترة محدودة على كافة المنتجات",
      image: "/uploads/seed/offer-all.jpg",
      offerType: "DISCOUNT_PERCENTAGE",
      target: "ALL_PRODUCTS",
      discountPercentage: 15,
      startDate: daysAgo(20),
      endDate: daysAgo(-15),
      isActive: true,
      displayOrder: 1,
    },
    {
      title: "خصم 50 د.ل على الساعات",
      description: "على مجموعة مختارة من الساعات",
      image: "/uploads/seed/offer-watches.jpg",
      offerType: "DISCOUNT_AMOUNT",
      target: "SPECIFIC_PRODUCTS",
      discountAmount: 5000,
      productIds: [products[3].id, products[17].id],
      startDate: daysAgo(10),
      endDate: daysAgo(-20),
      isActive: true,
      displayOrder: 2,
    },
    {
      title: "اشتري واحدة واحصل على الثانية",
      description: "على ماركة Nike",
      image: "/uploads/seed/offer-nike.jpg",
      offerType: "BUY_ONE_GET_ONE",
      target: "SPECIFIC_BRANDS",
      brandIds: [brands.nike.id],
      startDate: daysAgo(30),
      endDate: daysAgo(-5),
      isActive: true,
      displayOrder: 3,
    },
    {
      title: "شحن مجاني للعناية بالبشرة",
      description: "لمجموعة العناية بالبشرة بالكامل",
      image: "/uploads/seed/offer-skincare.jpg",
      offerType: "FREE_SHIPPING",
      target: "SPECIFIC_CATEGORIES",
      categoryIds: [catBySlug["skincare"].id],
      startDate: daysAgo(5),
      endDate: daysAgo(-10),
      isActive: true,
      displayOrder: 4,
    },
  ];

  for (const o of offers) {
    const { productIds, categoryIds, brandIds, ...data } = o;
    await prisma.offer.create({
      data: {
        ...data,
        offerProducts: productIds
          ? { create: productIds.map((productId) => ({ productId })) }
          : undefined,
        offerCategories: categoryIds
          ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
        offerBrands: brandIds
          ? { create: brandIds.map((brandId) => ({ brandId })) }
          : undefined,
      },
    });
  }
}

// ======================= الطلبات =======================
async function seedOrders(users, variants) {
  const customers = users.CUSTOMER.slice(0, 8);
  const deliverers = [users.DELIVERY[0], users.DELIVERY[1], users.DELIVERY[2]];

  // [customerIdx, daysAgo, status, [[variantIdx, qty], ...], assignedTo(null|deliveryIdx)]
  const ORDER_DEFS = [
    [0, 1, "PENDING", [[0, 1], [49, 1]], null],
    [0, 1, "PENDING", [[42, 2]], 0],
    [1, 2, "CONFIRMED", [[7, 1], [46, 1]], 1],
    [2, 3, "PENDING", [[41, 1]], 0],
    [3, 4, "CONFIRMED", [[13, 1], [34, 1]], 2],
    [1, 6, "SHIPPING", [[25, 1]], 1],
    [4, 8, "SHIPPING", [[49, 1]], 0],
    [5, 10, "DELIVERED", [[44, 2], [0, 1]], 2],
    [6, 12, "DELIVERED", [[16, 1]], 1],
    [7, 15, "DELIVERED", [[37, 1], [4, 1]], 0],
    [0, 18, "DELIVERED", [[24, 1]], 2],
    [2, 22, "DELIVERED", [[20, 2]], 1],
    [3, 25, "DELIVERED", [[28, 1], [40, 1]], 0],
    [4, 28, "DELIVERED", [[31, 1]], 2],
    [5, 35, "DELIVERED", [[5, 1]], 1],
    [6, 40, "DELIVERED", [[11, 1], [3, 2]], 0],
    [7, 45, "DELIVERED", [[8, 1]], 2],
    [0, 60, "CANCELLED", [[14, 1], [49, 1]], null],
  ];

  let orderNumberSeq = 1001;
  const orders = [];

  for (const [cIdx, dAgo, status, itemDefs, deliveryIdx] of ORDER_DEFS) {
    const customer = customers[cIdx];
    const createdAt = daysAgo(dAgo, (cIdx + dAgo) % 8);

    const orderItems = itemDefs.map(([vIdx, qty]) => {
      const v = variants[vIdx];
      return { variantId: v.id, unitPriceCents: v.priceCents, qty };
    });

    const totalCents = orderItems.reduce(
      (sum, it) => sum + it.unitPriceCents * it.qty,
      0
    );

    const orderNumber = `ORD-${createdAt.getFullYear()}-${orderNumberSeq++}`;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        status,
        totalCents,
        shippingName: customer.name,
        shippingPhone: customer.phone,
        shippingAddress: `طرابلس - شارع ${orderNumber} - منزل ${cIdx + 1}`,
        orderNumber,
        createdAt,
        updatedAt: createdAt,
        cancelDeadline:
          status === "PENDING" || status === "CONFIRMED"
            ? new Date(createdAt.getTime() + 24 * 3600 * 1000)
            : null,
        cancelledByUser: status === "CANCELLED",
        cancelledAt: status === "CANCELLED" ? daysAgo(dAgo, 2) : null,
        cancelledReason:
          status === "CANCELLED" ? "تغير رأي العميل بعد الطلب" : null,
        items: { create: orderItems },
      },
    });

    // سجل حركات الحالة
    const logEntries = [{ status: "PENDING", note: "تم إنشاء الطلب", actorType: "CUSTOMER", actorId: customer.id }];
    if (status === "CONFIRMED" || status === "SHIPPING" || status === "DELIVERED") {
      logEntries.push({ status: "CONFIRMED", note: "تم تأكيد الطلب", actorType: "ADMIN", actorId: users.ADMIN[0].id });
    }
    if (status === "SHIPPING" || status === "DELIVERED") {
      logEntries.push({ status: "SHIPPING", note: "تم شحن الطلب", actorType: "ADMIN", actorId: users.ADMIN[0].id });
    }
    if (status === "DELIVERED") {
      logEntries.push({ status: "DELIVERED", note: "تم تسليم الطلب بنجاح", actorType: "DELIVERY", actorId: deliverers[deliveryIdx ?? 0].id });
    }
    if (status === "CANCELLED") {
      logEntries.push({ status: "CANCELLED", note: "تم إلغاء الطلب من قبل العميل", actorType: "CUSTOMER", actorId: customer.id });
    }

    for (const entry of logEntries) {
      await prisma.orderStatusLog.create({
        data: { ...entry, orderId: order.id, createdAt },
      });
    }

    // تعيين مندوب للطلبات المحددة
    if (deliveryIdx !== null) {
      const delivery = deliverers[deliveryIdx];
      const assignmentStatus =
        status === "DELIVERED"
          ? "DELIVERED"
          : status === "SHIPPING"
          ? "ACCEPTED"
          : "ASSIGNED";

      await prisma.deliveryAssignment.create({
        data: {
          orderId: order.id,
          deliveryId: delivery.id,
          status: assignmentStatus,
          assignedAt: createdAt,
          acceptedAt: assignmentStatus === "ASSIGNED" ? null : createdAt,
          deliveredAt:
            assignmentStatus === "DELIVERED"
              ? new Date(createdAt.getTime() + 6 * 3600 * 1000)
              : null,
          note: assignmentStatus === "ASSIGNED" ? "بانتظار القبول" : null,
        },
      });
    }

    orders.push(order);
  }

  return orders;
}

// ======================= سلات / مفضلات / إشعارات =======================
async function seedCartsWishlistsNotifications(users, products, orders) {
  const customers = users.CUSTOMER;

  // سلات
  const cartDefs = [
    [0, [[0, 2], [42, 1]]],
    [1, [[7, 1]]],
    [2, [[41, 1], [13, 1]]],
    [3, [[25, 2]]],
  ];
  for (const [cIdx, items] of cartDefs) {
    const cart = await prisma.cart.create({ data: { userId: customers[cIdx].id } });
    for (const [vIdx, qty] of items) {
      const v = (await prisma.productVariant.findMany())[vIdx];
      await prisma.cartItem.create({ data: { cartId: cart.id, variantId: v.id, qty } });
    }
  }

  // مفضلات
  const wishDefs = [
    [0, [0, 2, 14]],
    [1, [7, 10]],
    [2, [5, 17]],
    [3, [13, 16]],
    [4, [1, 3]],
    [5, [11, 12]],
  ];
  for (const [cIdx, pIdxs] of wishDefs) {
    const wishlist = await prisma.wishlist.create({
      data: { userId: customers[cIdx].id },
    });
    for (const pIdx of pIdxs) {
      await prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId: products[pIdx].id },
      });
    }
  }

  // إشعارات
  const notifications = [
    [0, "ORDER_CREATED", "تم إنشاء طلبك", "تم استلام طلبك وهو قيد المراجعة", false],
    [0, "ORDER_CONFIRMED", "تم تأكيد طلبك", "طلبك مؤكد وجاري تجهيزه", false],
    [1, "ORDER_SHIPPED", "طلبك في الطريق", "تم شحن طلبك وسيصلك قريباً", false],
    [2, "ORDER_DELIVERED", "تم التسليم", "تم تسليم طلبك بنجاح. شكراً لثقتك", false],
    [3, "ORDER_DELIVERED", "تم التسليم", "تم تسليم طلبك بنجاح. شكراً لثقتك", false],
    [4, "PROMOTIONAL", "خصومات الموسم", "خصم يصل حتى 30% على منتجات مختارة", false],
    [5, "SYSTEM", "تحديث جديد", "أضفنا منتجات جديدة إلى المتجر", false],
  ];
  for (const [cIdx, type, title, body, isRead] of notifications) {
    await prisma.notification.create({
      data: {
        userId: customers[cIdx].id,
        type,
        title,
        body,
        isRead,
        data: orders.length ? { orderId: orders[0].id } : undefined,
      },
    });
  }

  // توكنات أجهزة
  const deviceTokens = [
    [0, "fcm-token-customer-1-android", "android"],
    [1, "fcm-token-customer-2-ios", "ios"],
    [2, "fcm-token-customer-3-web", "web"],
  ];
  for (const [cIdx, token, platform] of deviceTokens) {
    await prisma.deviceToken.create({
      data: { userId: customers[cIdx].id, token, platform, lang: "ar" },
    });
  }
}

async function main() {
  await resetDatabase();

  const users = await seedUsers();
  console.log(`✅ المستخدمون: ${users.ADMIN.length + users.CUSTOMER.length + users.DELIVERY.length}`);

  await seedCategories();
  const categories = await prisma.category.findMany();
  console.log(`✅ التصنيفات: ${categories.length}`);

  const { brands, products, variants } = await seedCatalog();
  console.log(`✅ الماركات: ${Object.keys(brands).length} | المنتجات: ${products.length} | المتغيرات: ${variants.length}`);

  await seedOffers(products, brands, categories);
  console.log(`✅ العروض: ${await prisma.offer.count()}`);

  const orders = await seedOrders(users, variants);
  console.log(`✅ الطلبات: ${orders.length}`);

  await seedCartsWishlistsNotifications(users, products, orders);
  console.log(`✅ السلات: ${await prisma.cart.count()} | المفضلات: ${await prisma.wishlist.count()} | الإشعارات: ${await prisma.notification.count()}`);

  console.log(`✅ تعيينات التوصيل: ${await prisma.deliveryAssignment.count()} | سجلات الحالات: ${await prisma.orderStatusLog.count()}`);
  console.log("🎉 اكتمل البذر بنجاح");
}

main()
  .catch((e) => {
    console.error("❌ خطأ في البذر:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });