-- DropForeignKey
ALTER TABLE `offerbrand` DROP FOREIGN KEY `OfferBrand_brandId_fkey`;

-- DropForeignKey
ALTER TABLE `offerbrand` DROP FOREIGN KEY `OfferBrand_offerId_fkey`;

-- DropForeignKey
ALTER TABLE `offercategory` DROP FOREIGN KEY `OfferCategory_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `offercategory` DROP FOREIGN KEY `OfferCategory_offerId_fkey`;

-- DropForeignKey
ALTER TABLE `offerproduct` DROP FOREIGN KEY `OfferProduct_offerId_fkey`;

-- DropForeignKey
ALTER TABLE `offerproduct` DROP FOREIGN KEY `OfferProduct_productId_fkey`;

-- AlterTable
ALTER TABLE `offer` DROP COLUMN `discountAmount`,
    DROP COLUMN `discountPercentage`,
    DROP COLUMN `maxDiscountAmount`,
    DROP COLUMN `minPurchaseAmount`,
    DROP COLUMN `offerType`,
    DROP COLUMN `target`;

-- AlterTable
ALTER TABLE `orderitem` DROP COLUMN `offerId`;

-- DropTable
DROP TABLE `offerbrand`;

-- DropTable
DROP TABLE `offercategory`;

-- DropTable
DROP TABLE `offerproduct`;


