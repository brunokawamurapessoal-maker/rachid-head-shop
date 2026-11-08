import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) {
    return NextResponse.json({ erro: "Entre na sua conta para continuar." }, { status: 401 });
  }

  try {
    const purchasedProducts = await prisma.orderItem.findMany({
      where: {
        order: { is: { customerId, status: { not: "cancelado" } } },
        product: { is: { active: true, promotionPercent: { gt: 0 } } },
      },
      select: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrls: true,
            icon: true,
            priceInCents: true,
            promotionPercent: true,
          },
        },
      },
      distinct: ["productId"],
    });

    const promotions = purchasedProducts.flatMap(({ product }) => {
      if (!product) return [];
      return [{
        id: product.id,
        name: product.name,
        image: product.imageUrls.split(/\r?\n/).map((url) => url.trim()).find(Boolean) ?? "",
        icon: product.icon,
        originalPriceInCents: product.priceInCents,
        priceInCents: Math.max(1, Math.round(product.priceInCents * (100 - product.promotionPercent) / 100)),
        promotionPercent: product.promotionPercent,
      }];
    });
    return NextResponse.json({ promotions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar promoções relacionadas às compras do cliente:", error);
    return NextResponse.json({ erro: "Não foi possível carregar as promoções agora." }, { status: 503 });
  }
}
