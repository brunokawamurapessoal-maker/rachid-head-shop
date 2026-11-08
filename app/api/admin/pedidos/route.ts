import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const orderStatuses = ["pendente", "confirmado", "em_preparacao", "enviado", "concluido", "cancelado"] as const;

export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { items: { orderBy: { productName: "asc" } } },
    });
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar pedidos no painel:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os pedidos." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }

  let body: { id?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados do pedido em JSON válido." }, { status: 400 });
  }
  if (
    typeof body.id !== "string" ||
    typeof body.status !== "string" ||
    !orderStatuses.includes(body.status as (typeof orderStatuses)[number])
  ) {
    return NextResponse.json({ erro: "Pedido ou status inválido." }, { status: 400 });
  }

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const current = await transaction.order.findUnique({
        where: { id: body.id as string },
        include: { items: { select: { productId: true, quantity: true, productName: true } } },
      });
      if (!current) return null;

      const isCancelling = body.status === "cancelado" && current.status !== "cancelado";
      const isRestoring = current.status === "cancelado" && body.status !== "cancelado";
      if (isCancelling && current.inventoryTracked && current.stockDeducted) {
        for (const item of current.items) {
          if (!item.productId) continue;
          await transaction.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      } else if (isRestoring && current.inventoryTracked) {
        for (const item of current.items) {
          if (!item.productId) continue;
          const updated = await transaction.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (updated.count !== 1) throw new Error(`Estoque insuficiente para restaurar o pedido: ${item.productName}.`);
        }
      }

      return transaction.order.update({
        where: { id: current.id },
        data: {
          status: body.status as string,
          ...(isCancelling && current.inventoryTracked && current.stockDeducted ? { stockDeducted: false } : {}),
          ...(isRestoring && current.inventoryTracked ? { stockDeducted: true } : {}),
        },
        select: { id: true, status: true },
      });
    });
    if (!order) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Estoque insuficiente para restaurar")) {
      return NextResponse.json({ erro: error.message }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
    }
    console.error("Falha ao atualizar status do pedido:", error);
    return NextResponse.json({ erro: "Não foi possível atualizar o pedido." }, { status: 503 });
  }
}
