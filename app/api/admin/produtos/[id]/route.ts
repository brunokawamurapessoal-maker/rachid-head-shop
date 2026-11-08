import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { parseAdminProductInput } from "@/lib/admin-products";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados do produto em JSON válido." }, { status: 400 });
  }
  const parsed = await parseAdminProductInput(body);
  if (!parsed.ok) return NextResponse.json({ erro: parsed.error }, { status: 400 });

  const { id } = await context.params;
  try {
    const product = await prisma.product.update({ where: { id }, data: parsed.value });
    return NextResponse.json({ product });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ erro: "Já existe um produto com esse slug." }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 });
    }
    console.error("Falha ao atualizar produto:", error);
    return NextResponse.json({ erro: "Não foi possível atualizar o produto." }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const product = await prisma.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ product });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ erro: "Produto não encontrado." }, { status: 404 });
    }
    console.error("Falha ao desativar produto:", error);
    return NextResponse.json({ erro: "Não foi possível desativar o produto." }, { status: 503 });
  }
}
