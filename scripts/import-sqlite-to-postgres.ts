import { resolve } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { Prisma, PrismaClient } from "@prisma/client";

type SqliteRow = Record<string, SQLOutputValue>;

const prisma = new PrismaClient();

function readTable<T>(db: DatabaseSync, table: string, map: (row: SqliteRow) => T): T[] {
  return db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all().map(map);
}

function string(row: SqliteRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") throw new Error(`Missing text value in ${column}.`);
  return value;
}

function optionalString(row: SqliteRow, column: string): string | null {
  const value = row[column];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Invalid text value in ${column}.`);
  return value;
}

function integer(row: SqliteRow, column: string): number {
  const value = row[column];
  const result = typeof value === "bigint" ? Number(value) : value;
  if (typeof result !== "number" || !Number.isSafeInteger(result)) {
    throw new Error(`Invalid integer value in ${column}.`);
  }
  return result;
}

function optionalInteger(row: SqliteRow, column: string): number | null {
  const value = row[column];
  if (value === null) return null;
  const result = typeof value === "bigint" ? Number(value) : value;
  if (typeof result !== "number" || !Number.isSafeInteger(result)) {
    throw new Error(`Invalid integer value in ${column}.`);
  }
  return result;
}

function boolean(row: SqliteRow, column: string): boolean {
  const value = row[column];
  if (value === 0 || value === 1) return value === 1;
  throw new Error(`Invalid boolean value in ${column}.`);
}

function date(row: SqliteRow, column: string): Date {
  const value = row[column];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`Invalid date value in ${column}.`);
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error(`Invalid date value in ${column}.`);
  return result;
}

function optionalDate(row: SqliteRow, column: string): Date | null {
  if (row[column] === null) return null;
  return date(row, column);
}

function assertSupportedNodeVersion() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 5)) {
    throw new Error("SQLite import requires Node.js 22.5 or newer.");
  }
}

async function main() {
  assertSupportedNodeVersion();

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const sourcePath = resolve(args.find((arg) => arg !== "--dry-run") ?? "prisma/dev.db");
  const source = new DatabaseSync(sourcePath, { readOnly: true });

  let categories: Prisma.CategoryCreateManyInput[];
  let products: Prisma.ProductCreateManyInput[];
  let orders: Prisma.OrderCreateManyInput[];
  let orderItems: Prisma.OrderItemCreateManyInput[];
  let storeSettings: Prisma.StoreSettingsCreateManyInput[];
  let customers: Prisma.CustomerCreateManyInput[];
  let deliveryZones: Prisma.DeliveryZoneCreateManyInput[];
  let recoveryRequests: Prisma.CustomerRecoveryRequestCreateManyInput[];

  try {
    source.exec("BEGIN");
    categories = readTable(source, "Category", (row) => ({
      id: string(row, "id"),
      name: string(row, "name"),
      icon: string(row, "icon"),
    }));
    storeSettings = readTable(source, "StoreSettings", (row) => ({
      id: string(row, "id"),
      name: string(row, "name"),
      legalName: string(row, "legalName"),
      document: string(row, "document"),
      email: string(row, "email"),
      phone: string(row, "phone"),
      whatsapp: string(row, "whatsapp"),
      postalCode: string(row, "postalCode"),
      address: string(row, "address"),
      city: string(row, "city"),
      state: string(row, "state"),
      instagram: string(row, "instagram"),
      updatedAt: date(row, "updatedAt"),
    }));
    customers = readTable(source, "Customer", (row) => ({
      id: string(row, "id"),
      name: string(row, "name"),
      email: string(row, "email"),
      phone: string(row, "phone"),
      passwordHash: string(row, "passwordHash"),
      sessionVersion: integer(row, "sessionVersion"),
      cpfHash: optionalString(row, "cpfHash"),
      postalCode: string(row, "postalCode"),
      address: string(row, "address"),
      addressNumber: string(row, "addressNumber"),
      neighborhood: string(row, "neighborhood"),
      deliveryReference: string(row, "deliveryReference"),
      city: string(row, "city"),
      state: string(row, "state"),
      createdAt: date(row, "createdAt"),
      updatedAt: date(row, "updatedAt"),
    }));
    deliveryZones = readTable(source, "DeliveryZone", (row) => ({
      id: string(row, "id"),
      name: string(row, "name"),
      postalCodeStart: string(row, "postalCodeStart"),
      postalCodeEnd: string(row, "postalCodeEnd"),
      priceInCents: integer(row, "priceInCents"),
      active: boolean(row, "active"),
      createdAt: date(row, "createdAt"),
      updatedAt: date(row, "updatedAt"),
    }));
    products = readTable(source, "Product", (row) => ({
      id: string(row, "id"),
      slug: string(row, "slug"),
      name: string(row, "name"),
      description: string(row, "description"),
      priceInCents: integer(row, "priceInCents"),
      costInCents: optionalInteger(row, "costInCents"),
      imageUrls: string(row, "imageUrls"),
      promotionPercent: integer(row, "promotionPercent"),
      stock: integer(row, "stock"),
      minStock: integer(row, "minStock"),
      badge: string(row, "badge"),
      icon: string(row, "icon"),
      active: boolean(row, "active"),
      categoryId: string(row, "categoryId"),
      createdAt: date(row, "createdAt"),
      updatedAt: date(row, "updatedAt"),
    }));
    orders = readTable(source, "Order", (row) => ({
      id: string(row, "id"),
      status: string(row, "status"),
      customerId: optionalString(row, "customerId"),
      customerName: string(row, "customerName"),
      customerEmail: string(row, "customerEmail"),
      customerPhone: string(row, "customerPhone"),
      postalCode: string(row, "postalCode"),
      address: string(row, "address"),
      addressNumber: string(row, "addressNumber"),
      neighborhood: string(row, "neighborhood"),
      deliveryReference: string(row, "deliveryReference"),
      city: string(row, "city"),
      state: string(row, "state"),
      shippingMethod: string(row, "shippingMethod"),
      shippingPending: boolean(row, "shippingPending"),
      stockDeducted: boolean(row, "stockDeducted"),
      inventoryTracked: boolean(row, "inventoryTracked"),
      paymentMethod: string(row, "paymentMethod"),
      cashChangeForInCents: integer(row, "cashChangeForInCents"),
      subtotalInCents: integer(row, "subtotalInCents"),
      shippingInCents: integer(row, "shippingInCents"),
      discountInCents: integer(row, "discountInCents"),
      totalInCents: integer(row, "totalInCents"),
      createdAt: date(row, "createdAt"),
      updatedAt: date(row, "updatedAt"),
    }));
    orderItems = readTable(source, "OrderItem", (row) => ({
      id: string(row, "id"),
      orderId: string(row, "orderId"),
      productId: optionalString(row, "productId"),
      productName: string(row, "productName"),
      quantity: integer(row, "quantity"),
      unitPriceInCents: integer(row, "unitPriceInCents"),
      unitCostInCents: optionalInteger(row, "unitCostInCents"),
    }));
    recoveryRequests = readTable(source, "CustomerRecoveryRequest", (row) => ({
      id: string(row, "id"),
      customerId: optionalString(row, "customerId"),
      emailHash: string(row, "emailHash"),
      ipHash: string(row, "ipHash"),
      tokenHash: optionalString(row, "tokenHash"),
      attempts: integer(row, "attempts"),
      expiresAt: date(row, "expiresAt"),
      consumedAt: optionalDate(row, "consumedAt"),
      createdAt: date(row, "createdAt"),
    }));
  } finally {
    source.close();
  }

  const sourceCounts = {
    categories: categories.length,
    products: products.length,
    orders: orders.length,
    orderItems: orderItems.length,
    storeSettings: storeSettings.length,
    customers: customers.length,
    deliveryZones: deliveryZones.length,
    recoveryRequests: recoveryRequests.length,
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, source: sourceCounts }));
    return;
  }
  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("Set DATABASE_URL to the Supabase PostgreSQL connection pooler before importing.");
  }

  try {
    const destinationCounts = await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.storeSettings.count(),
      prisma.customer.count(),
      prisma.deliveryZone.count(),
      prisma.customerRecoveryRequest.count(),
    ]);
    if (destinationCounts.some((count) => count > 0)) {
      throw new Error("The PostgreSQL destination must be empty before importing SQLite data.");
    }

    const imported = await prisma.$transaction(async (tx) => {
      const importedCounts = {
        categories: (await tx.category.createMany({ data: categories })).count,
        products: (await tx.product.createMany({ data: products })).count,
        orders: (await tx.order.createMany({ data: orders })).count,
        orderItems: (await tx.orderItem.createMany({ data: orderItems })).count,
        storeSettings: (await tx.storeSettings.createMany({ data: storeSettings })).count,
        customers: (await tx.customer.createMany({ data: customers })).count,
        deliveryZones: (await tx.deliveryZone.createMany({ data: deliveryZones })).count,
        recoveryRequests: (await tx.customerRecoveryRequest.createMany({ data: recoveryRequests })).count,
      };
      const matchesSource = (Object.keys(sourceCounts) as (keyof typeof sourceCounts)[])
        .every((key) => importedCounts[key] === sourceCounts[key]);
      if (!matchesSource) throw new Error("The PostgreSQL import counts do not match the SQLite source.");
      return importedCounts;
    }, { timeout: 120_000 });

    console.log(JSON.stringify({ imported }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
