import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: { where: { active: true } } } } },
      }),
      prisma.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          priceInCents: true,
          imageUrls: true,
          promotionPercent: true,
          stock: true,
          badge: true,
          icon: true,
          categoryId: true,
        },
      }),
    ]);

    return NextResponse.json({
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        count: _count.products,
      })),
      products: products.map(({ priceInCents, imageUrls, promotionPercent, ...product }) => ({
        ...product,
        price: Math.max(1, Math.round(priceInCents * (100 - promotionPercent) / 100)) / 100,
        originalPrice: priceInCents / 100,
        promotionPercent,
        images: imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
      })),
    });
  } catch (error) {
    console.error("Falha ao carregar o catálogo:", error);
    return NextResponse.json(
      { erro: "Não foi possível carregar o catálogo." },
      { status: 503 },
    );
  }
}
