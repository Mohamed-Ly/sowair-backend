-- Category: إضافة تصنيف الأب (parentId) لدعم التصنيفات الهرمية متعددة الأقسام
ALTER TABLE `Category` ADD COLUMN `parentId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddIndex
CREATE INDEX `Category_parentId_idx` ON `Category`(`parentId`);

-- ProductVariant: استبدال حقول العطور (sizeMl/concentration) بخيارات عامة (option1/option2)
ALTER TABLE `ProductVariant` DROP INDEX `ProductVariant_productId_sizeMl_concentration_key`;

ALTER TABLE `ProductVariant`
  CHANGE `sizeMl` `option1` VARCHAR(191) NULL,
  CHANGE `concentration` `option2` VARCHAR(191) NULL;

-- ترحيل بيانات العطور القديمة: الحجم -> نص وصفي عام، التركيز يبقى نصاً
UPDATE `ProductVariant` SET `option1` = CONCAT('الحجم: ', `option1`, ' مل') WHERE `option1` IS NOT NULL;

-- AddIndex الجديدة (تفرّد لكل منتج بالخيارين)
CREATE UNIQUE INDEX `ProductVariant_productId_option1_option2_key` ON `ProductVariant`(`productId`, `option1`, `option2`);