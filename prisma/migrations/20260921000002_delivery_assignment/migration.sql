-- AlterTable: إضافة دور DELIVERY إلى الـ enum
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'CUSTOMER', 'DELIVERY') NOT NULL DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE `DeliveryAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `deliveryId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ASSIGNED',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `DeliveryAssignment_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DeliveryAssignment_deliveryId_idx` ON `DeliveryAssignment`(`deliveryId`);

-- CreateIndex
CREATE INDEX `DeliveryAssignment_status_idx` ON `DeliveryAssignment`(`status`);

-- AddForeignKey
ALTER TABLE `DeliveryAssignment` ADD CONSTRAINT `DeliveryAssignment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryAssignment` ADD CONSTRAINT `DeliveryAssignment_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;