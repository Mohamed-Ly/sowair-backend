// services/pricing.service.js
//
// حساب سعر الطلب. مفيش خصومات: العروض دلوقتي بانرات للعرض فقط
// (صورة + عنوان + وصف + تواريخ) وما بتأثرش على أي سعر.
//
// لو في يوم حبيت تضيف تخفيضات، مكانها الطبيعي هنا: ترجع discountCents
// لكل سطر وتطرحها من الإجمالي. الحقولdiscountCents موجودة في OrderItem
// ومالهاش لازمة تكون صفر.

/**
 * يحسب أسطر الطلب وإجماليه من عناصر السلة.
 *
 * @param {object} tx Prisma transaction (أو prisma)
 * @param {Array} cartItems عناصر السلة: { variantId, qty, unitPriceCents }
 * @returns {{lines, subtotalCents, discountCents, totalCents, offer}}
 */
async function priceCartItems(tx, cartItems) {
  const lines = cartItems.map((i) => ({
    variantId: i.variantId,
    qty: i.qty,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: i.unitPriceCents * i.qty,
    // دايماً 0: مفيش خصومات. البانرات ما بتخصمش.
    discountCents: 0,
  }));

  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const totalCents = subtotalCents > 0 ? subtotalCents : 0;

  return {
    lines,
    subtotalCents,
    discountCents: 0,
    totalCents,
    offer: null,
  };
}

module.exports = { priceCartItems };
