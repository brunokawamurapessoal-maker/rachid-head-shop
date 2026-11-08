CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "addressNumber" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "deliveryReference" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "postalCodeStart" TEXT NOT NULL,
    "postalCodeEnd" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "DeliveryZone_active_postalCodeStart_postalCodeEnd_idx"
ON "DeliveryZone"("active", "postalCodeStart", "postalCodeEnd");

ALTER TABLE "Order" ADD COLUMN "customerId" TEXT REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "addressNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "neighborhood" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "deliveryReference" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "shippingPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "cashChangeForInCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

ALTER TABLE "Product" ADD COLUMN "costInCents" INTEGER;
ALTER TABLE "Product" ADD COLUMN "minStock" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Product" ADD COLUMN "imageUrls" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN "unitCostInCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN "stockDeducted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "inventoryTracked" BOOLEAN NOT NULL DEFAULT false;
