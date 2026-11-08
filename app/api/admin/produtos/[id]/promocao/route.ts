import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }

  let body: { percent?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados da promoção em JSON válido." }, { status: 400 });
  }
  if (typeof body.percent !== "number" || !Number.isInteger(body.percent) || body.percent < 0 || body.percent > 90) {
    return NextResponse.json({ erro: "Informe um desconto inteiro entre 0% e 90%." }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { promotionPercent: Number(body.percent) },
      select: { id: true, promotionPercent: true },
    });
    return NextResponse.json({ product });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 });
    }
    console.error("Falha ao atualizar promoção do produto:", error);
    return NextResponse.json({ erro: "Não foi possível salvar a promoção." }, { status: 503 });
  }
}
