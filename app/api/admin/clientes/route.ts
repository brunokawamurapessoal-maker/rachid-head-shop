import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() ?? "";
  const cursor = searchParams.get("cursor")?.trim();
  if (query.length > 100) {
    return NextResponse.json({ erro: "A busca pode ter no máximo 100 caracteres." }, { status: 400 });
  }
  if (cursor && cursor.length > 64) {
    return NextResponse.json({ erro: "O cursor de paginação é inválido." }, { status: 400 });
  }

  try {
    const customers = await prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });

    const hasMore = customers.length > PAGE_SIZE;
    const page = customers.slice(0, PAGE_SIZE);
    return NextResponse.json({
      customers: page,
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar clientes no painel:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os clientes." }, { status: 503 });
  }
}
