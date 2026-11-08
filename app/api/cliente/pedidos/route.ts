import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) return NextResponse.json({ erro: "Entre na sua conta para continuar." }, { status: 401 });

  try {
    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: { orderBy: { productName: "asc" } } },
    });
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar pedidos do cliente:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os pedidos agora." }, { status: 503 });
  }
}
