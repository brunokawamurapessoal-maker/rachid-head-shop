import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        city: true,
        state: true,
        shippingMethod: true,
        paymentMethod: true,
        subtotalInCents: true,
        shippingInCents: true,
        discountInCents: true,
        totalInCents: true,
        createdAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPriceInCents: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ...order,
      subtotal: order.subtotalInCents / 100,
      frete: order.shippingInCents / 100,
      desconto: order.discountInCents / 100,
      total: order.totalInCents / 100,
      itens: order.items.map((item) => ({
        nome: item.productName,
        quantidade: item.quantity,
        precoUnitario: item.unitPriceInCents / 100,
      })),
    });
  } catch (error) {
    console.error("Falha ao consultar pedido:", error);
    return NextResponse.json(
      { erro: "Não foi possível consultar o pedido agora." },
      { status: 503 },
    );
  }
}
