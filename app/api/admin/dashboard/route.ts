import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const periodChoices = new Set([7, 15, 30, 120, 240]);

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function allocateDiscount(discountInCents: number, itemGross: number, subtotalInCents: number, isLast: boolean, remaining: number) {
  if (isLast) return remaining;
  return subtotalInCents > 0 ? Math.min(remaining, Math.round(discountInCents * itemGross / subtotalInCents)) : 0;
}

export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let start: Date;
  let end: Date;
  let periodLabel: string;

  if (search.has("start") || search.has("end")) {
    const parsedStart = parseDate(search.get("start"));
    const parsedEnd = parseDate(search.get("end"));
    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
      return NextResponse.json({ erro: "Informe uma data inicial e final válidas." }, { status: 400 });
    }
    const rangeDays = Math.floor((parsedEnd.getTime() - parsedStart.getTime()) / 86_400_000) + 1;
    if (rangeDays > 1826) {
      return NextResponse.json({ erro: "O intervalo personalizado pode ter no máximo cinco anos." }, { status: 400 });
    }
    start = parsedStart;
    end = new Date(parsedEnd);
    end.setDate(end.getDate() + 1);
    periodLabel = `${formatDate(parsedStart)} a ${formatDate(parsedEnd)}`;
  } else {
    const days = Number(search.get("days") ?? "7");
    if (!periodChoices.has(days)) {
      return NextResponse.json({ erro: "Escolha 7, 15, 30, 120 ou 240 dias." }, { status: 400 });
    }
    start = new Date(today);
    start.setUTCDate(today.getUTCDate() - days + 1);
    end = new Date(today);
    end.setUTCDate(today.getUTCDate() + 1);
    periodLabel = `Últimos ${days} dias`;
  }

  try {
    const [orders, productInventory] = await Promise.all([
      prisma.order.findMany({
        where: { status: { not: "cancelado" }, createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: "asc" },
        include: { items: { select: { productName: true, productId: true, quantity: true, unitPriceInCents: true, unitCostInCents: true } } },
      }),
      prisma.product.findMany({
        where: { active: true },
        select: { id: true, stock: true, minStock: true },
      }),
    ]);

    const revenueInCents = orders.reduce((sum, order) => sum + order.subtotalInCents - order.discountInCents, 0);
    const itemSales = new Map<string, {
      productId: string | null;
      name: string;
      quantitySold: number;
      revenueInCents: number;
      discountInCents: number;
      costInCents: number;
      missingCostQuantity: number;
    }>();
    let totalCostInCents = 0;
    let missingCostQuantity = 0;

    for (const order of orders) {
      const itemGrossTotal = order.items.reduce((sum, item) => sum + item.unitPriceInCents * item.quantity, 0);
      let discountRemaining = order.discountInCents;
      order.items.forEach((item, index) => {
        const key = item.productId ?? `deleted:${item.productName}`;
        const lineRevenue = item.unitPriceInCents * item.quantity;
        const discount = allocateDiscount(order.discountInCents, lineRevenue, itemGrossTotal, index === order.items.length - 1, discountRemaining);
        discountRemaining -= discount;
        const current = itemSales.get(key) ?? {
          productId: item.productId,
          name: item.productName,
          quantitySold: 0,
          revenueInCents: 0,
          discountInCents: 0,
          costInCents: 0,
          missingCostQuantity: 0,
        };
        current.quantitySold += item.quantity;
        current.revenueInCents += lineRevenue;
        current.discountInCents += discount;
        if (item.unitCostInCents === null) {
          current.missingCostQuantity += item.quantity;
          missingCostQuantity += item.quantity;
        } else {
          const itemCost = item.unitCostInCents * item.quantity;
          current.costInCents += itemCost;
          totalCostInCents += itemCost;
        }
        itemSales.set(key, current);
      });
    }

    const productsSold = [...itemSales.values()]
      .map((item) => {
        const netRevenue = item.revenueInCents - item.discountInCents;
        const grossProfit = item.missingCostQuantity ? null : netRevenue - item.costInCents;
        return {
          productId: item.productId,
          name: item.name,
          quantitySold: item.quantitySold,
          revenueInCents: netRevenue,
          costInCents: item.missingCostQuantity ? null : item.costInCents,
          grossProfitInCents: grossProfit,
          grossMarginPercent: grossProfit === null || netRevenue <= 0 ? null : Math.round(grossProfit / netRevenue * 1000) / 10,
          missingCostQuantity: item.missingCostQuantity,
        };
      })
      .sort((left, right) => right.quantitySold - left.quantitySold || right.revenueInCents - left.revenueInCents)
      .slice(0, 10);

    const totalStock = productInventory.filter((product) => product.stock <= product.minStock).length;
    const totalCostKnown = missingCostQuantity === 0 && orders.every((order) => order.items.length > 0);
    const grossProfitInCents = totalCostKnown ? revenueInCents - totalCostInCents : null;
    const grossMarginPercent = grossProfitInCents === null || revenueInCents <= 0
      ? null
      : Math.round(grossProfitInCents / revenueInCents * 1000) / 10;

    const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
    const bucketDays = dayCount <= 30 ? 1 : dayCount <= 120 ? 7 : 30;
    const daily = new Map<string, { date: Date; revenueInCents: number; orderCount: number }>();
    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      const bucketDate = new Date(orderDate);
      if (bucketDays === 7) bucketDate.setUTCDate(bucketDate.getUTCDate() - ((bucketDate.getUTCDay() + 6) % 7));
      if (bucketDays === 30) bucketDate.setUTCDate(1);
      bucketDate.setUTCHours(0, 0, 0, 0);
      const key = formatDate(bucketDate);
      const bucket = daily.get(key) ?? { date: bucketDate, revenueInCents: 0, orderCount: 0 };
      bucket.revenueInCents += order.subtotalInCents - order.discountInCents;
      bucket.orderCount += 1;
      daily.set(key, bucket);
    }

    const days: { date: string; label: string; revenueInCents: number; orderCount: number }[] = [];
    for (let cursor = new Date(start); cursor < end;) {
      const bucketDate = new Date(cursor);
      if (bucketDays === 7) bucketDate.setUTCDate(bucketDate.getUTCDate() - ((bucketDate.getUTCDay() + 6) % 7));
      if (bucketDays === 30) bucketDate.setUTCDate(1);
      bucketDate.setUTCHours(0, 0, 0, 0);
      const key = formatDate(bucketDate);
      const bucket = daily.get(key);
      if (!days.some((day) => day.date === key)) {
        days.push({
          date: key,
          label: bucketDays === 1
            ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit" }).format(bucketDate).replace(".", "")
            : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short", day: "2-digit" }).format(bucketDate).replace(".", ""),
          revenueInCents: bucket?.revenueInCents ?? 0,
          orderCount: bucket?.orderCount ?? 0,
        });
      }
      if (bucketDays === 30) {
        cursor.setUTCDate(1);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + bucketDays);
      }
    }

    return NextResponse.json({
      periodLabel,
      startDate: formatDate(start),
      endDate: formatDate(new Date(end.getTime() - 86_400_000)),
      revenueInCents,
      orderCount: orders.length,
      grossProfitInCents,
      grossMarginPercent,
      totalCostInCents: totalCostKnown ? totalCostInCents : null,
      missingCostQuantity,
      activeProducts: productInventory.length,
      lowStock: totalStock,
      productsSold,
      days,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar o resumo de vendas:", error);
    return NextResponse.json({ erro: "Não foi possível carregar o resumo de vendas." }, { status: 503 });
  }
}
