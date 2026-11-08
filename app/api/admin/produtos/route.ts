import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { parseAdminProductInput } from "@/lib/admin-products";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.product.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { category: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({ categories, products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar o painel administrativo:", error);
    return NextResponse.json({ erro: "Não foi possível carregar o painel." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
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

  try {
    const product = await prisma.product.create({ data: parsed.value });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ erro: "Já existe um produto com esse slug." }, { status: 409 });
    }
    console.error("Falha ao criar produto:", error);
    return NextResponse.json({ erro: "Não foi possível criar o produto." }, { status: 503 });
  }
}
