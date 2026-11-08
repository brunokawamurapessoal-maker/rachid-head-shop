ALTER TABLE "Customer" ADD COLUMN "cpfHash" TEXT;
ALTER TABLE "Customer" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Customer_cpfHash_key" ON "Customer"("cpfHash");

ALTER TABLE "Product" ADD COLUMN "promotionPercent" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CustomerRecoveryRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "tokenHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerRecoveryRequest_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerRecoveryRequest_emailHash_createdAt_idx"
ON "CustomerRecoveryRequest"("emailHash", "createdAt");
CREATE INDEX "CustomerRecoveryRequest_ipHash_createdAt_idx"
ON "CustomerRecoveryRequest"("ipHash", "createdAt");
CREATE INDEX "CustomerRecoveryRequest_tokenHash_idx"
ON "CustomerRecoveryRequest"("tokenHash");
