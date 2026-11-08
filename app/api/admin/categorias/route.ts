import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ erro: "Envie os dados da categoria em JSON válido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ erro: "Dados da categoria inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const icon = typeof input.icon === "string" && input.icon.trim() ? input.icon.trim() : "📦";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ erro: "O nome da categoria deve ter de 2 a 80 caracteres." }, { status: 400 });
  }
  if (icon.length > 16) {
    return NextResponse.json({ erro: "O ícone deve ter no máximo 16 caracteres." }, { status: 400 });
  }

  try {
    const existing = await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ erro: "Já existe uma categoria com esse nome." }, { status: 409 });
    }

    const category = await prisma.category.create({
      data: { id: randomUUID(), name, icon },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar categoria:", error);
    return NextResponse.json({ erro: "Não foi possível criar a categoria." }, { status: 503 });
  }
}
