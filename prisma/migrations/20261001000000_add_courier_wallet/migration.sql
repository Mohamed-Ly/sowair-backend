-- AlterTable: Snapshot لرسوم التوصيل لحظة إنشاء الطلب (أساس محفظة المندوب)
ALTER TABLE `Order` ADD COLUMN `deliveryFeeCents` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `WalletTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `courierId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `refType` VARCHAR(191) NULL,
    `refId` INTEGER NULL,
    `orderNumber` VARCHAR(191) NULL,
    `deliveryFeeCents` INTEGER NULL,
    `method` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WalletTransaction_courierId_idx` ON `WalletTransaction`(`courierId`);

-- CreateIndex
CREATE INDEX `WalletTransaction_type_idx` ON `WalletTransaction`(`type`);

-- CreateIndex
CREATE INDEX `WalletTransaction_createdAt_idx` ON `WalletTransaction`(`createdAt`);

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_courierId_fkey` FOREIGN KEY (`courierId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;