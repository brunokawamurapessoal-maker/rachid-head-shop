import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: NextRequest) {
  if (!isValidAdminSession(request)) return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  return null;
}

function parseZone(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Dados da faixa de entrega inválidos." } as const;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const start = typeof input.postalCodeStart === "string" ? input.postalCodeStart.replace(/\D/g, "") : "";
  const end = typeof input.postalCodeEnd === "string" ? input.postalCodeEnd.replace(/\D/g, "") : "";
  const price = input.price;
  if (name.length < 2 || name.length > 80) return { error: "O nome da faixa deve ter de 2 a 80 caracteres." } as const;
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end) || start > end) {
    return { error: "Informe uma faixa válida de CEP inicial e final com 8 dígitos." } as const;
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 10000) {
    return { error: "Informe uma tarifa entre R$ 0,00 e R$ 10.000,00." } as const;
  }
  if (typeof input.active !== "boolean") return { error: "Informe se a faixa está ativa." } as const;
  return { value: { name, postalCodeStart: start, postalCodeEnd: end, priceInCents: Math.round(price * 100), active: input.active } } as const;
}

async function overlaps(start: string, end: string, excludeId?: string) {
  return prisma.deliveryZone.findFirst({
    where: {
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      postalCodeStart: { lte: end },
      postalCodeEnd: { gte: start },
    },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  try {
    const zones = await prisma.deliveryZone.findMany({ orderBy: [{ postalCodeStart: "asc" }, { name: "asc" }] });
    return NextResponse.json({ zones }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar faixas de entrega:", error);
    return NextResponse.json({ erro: "Não foi possível carregar as faixas de entrega." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados em JSON válido." }, { status: 400 });
  }
  const parsed = parseZone(body);
  if ("error" in parsed) return NextResponse.json({ erro: parsed.error }, { status: 400 });
  try {
    if (parsed.value.active && await overlaps(parsed.value.postalCodeStart, parsed.value.postalCodeEnd)) {
      return NextResponse.json({ erro: "Esta faixa se sobrepõe a outra faixa ativa." }, { status: 409 });
    }
    const zone = await prisma.deliveryZone.create({ data: parsed.value });
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar faixa de entrega:", error);
    return NextResponse.json({ erro: "Não foi possível criar a faixa." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  let body: { id?: unknown; zone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados em JSON válido." }, { status: 400 });
  }
  if (typeof body.id !== "string") return NextResponse.json({ erro: "Faixa de entrega inválida." }, { status: 400 });
  const parsed = parseZone(body.zone);
  if ("error" in parsed) return NextResponse.json({ erro: parsed.error }, { status: 400 });
  try {
    if (parsed.value.active && await overlaps(parsed.value.postalCodeStart, parsed.value.postalCodeEnd, body.id)) {
      return NextResponse.json({ erro: "Esta faixa se sobrepõe a outra faixa ativa." }, { status: 409 });
    }
    const zone = await prisma.deliveryZone.update({ where: { id: body.id }, data: parsed.value });
    return NextResponse.json({ zone });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ erro: "Faixa de entrega não encontrada." }, { status: 404 });
    }
    console.error("Falha ao atualizar faixa de entrega:", error);
    return NextResponse.json({ erro: "Não foi possível atualizar a faixa." }, { status: 503 });
  }
}
