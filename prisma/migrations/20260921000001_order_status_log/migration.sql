-- CreateTable
CREATE TABLE `OrderStatusLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `actorType` VARCHAR(191) NULL,
    `actorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `OrderStatusLog_orderId_idx` ON `OrderStatusLog`(`orderId`);

-- CreateIndex
CREATE INDEX `OrderStatusLog_status_idx` ON `OrderStatusLog`(`status`);

-- CreateIndex
CREATE INDEX `OrderStatusLog_createdAt_idx` ON `OrderStatusLog`(`createdAt`);

-- AddForeignKey
ALTER TABLE `OrderStatusLog` ADD CONSTRAINT `OrderStatusLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;