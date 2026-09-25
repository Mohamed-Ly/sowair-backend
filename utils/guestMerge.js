// utils/guestMerge.js
// دمج سلة ومفضلة الزائر مع حساب المستخدم عند تسجيل الدخول أو التسجيل
const prisma = require("../config/prisma");

exports.mergeGuestCartAndWishlistToUser = async (userId, guestId) => {
  if (!userId || !guestId) return { cartMerged: 0, wishlistMerged: 0 };

  return prisma.$transaction(async (tx) => {
    let cartMerged = 0;
    const guestCart = await tx.cart.findUnique({ where: { guestId } });

    if (guestCart) {
      const items = await tx.cartItem.findMany({
        where: { cartId: guestCart.id },
        include: { variant: true },
      });

      if (items.length) {
        let userCart = await tx.cart.findUnique({ where: { userId } });
        if (!userCart) userCart = await tx.cart.create({ data: { userId } });

        for (const it of items) {
          const stock = it.variant?.stockQty ?? 0;
          if (stock <= 0) continue;

          const existing = await tx.cartItem.findUnique({
            where: {
              cartId_variantId: {
                cartId: userCart.id,
                variantId: it.variantId,
              },
            },
          });

          const newQty = Math.min(stock, (existing ? existing.qty : 0) + it.qty);
          if (existing) {
            await tx.cartItem.update({
              where: { id: existing.id },
              data: { qty: newQty },
            });
          } else {
            await tx.cartItem.create({
              data: { cartId: userCart.id, variantId: it.variantId, qty: newQty },
            });
          }
          cartMerged++;
        }
      }

      // حذف عناصر سلة الزائر أولاً ثم السلة نفسها (لتجنب قيد المفتاح الأجنبي)
      await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
      await tx.cart.delete({ where: { id: guestCart.id } });
    }

    let wishlistMerged = 0;
    const guestWishlist = await tx.wishlist.findUnique({ where: { guestId } });

    if (guestWishlist) {
      const items = await tx.wishlistItem.findMany({
        where: { wishlistId: guestWishlist.id },
      });

      if (items.length) {
        let userWishlist = await tx.wishlist.findUnique({
          where: { userId },
        });
        if (!userWishlist) {
          userWishlist = await tx.wishlist.create({ data: { userId } });
        }

        for (const it of items) {
          await tx.wishlistItem.upsert({
            where: {
              wishlistId_productId: {
                wishlistId: userWishlist.id,
                productId: it.productId,
              },
            },
            create: { wishlistId: userWishlist.id, productId: it.productId },
            update: {},
          });
          wishlistMerged++;
        }
      }

      // حذف عناصر مفضلة الزائر أولاً ثم المفضلة نفسها
      await tx.wishlistItem.deleteMany({
        where: { wishlistId: guestWishlist.id },
      });
      await tx.wishlist.delete({ where: { id: guestWishlist.id } });
    }

    return { cartMerged, wishlistMerged };
  });
};