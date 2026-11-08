import { NextRequest, NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cep = request.nextUrl.searchParams.get("cep") ?? "";
  const rawSubtotal = Number(request.nextUrl.searchParams.get("valor") ?? "0");

  if (!Number.isFinite(rawSubtotal) || rawSubtotal < 0) {
    return NextResponse.json({ erro: "Valor do pedido inválido." }, { status: 400 });
  }

  try {
    const quote = await quoteShipping(cep, Math.round(rawSubtotal * 100));
    return NextResponse.json({
      ...quote.address,
      opcoes: quote.options.map(({ code, name, priceInCents, deliveryTime, free }) => ({
        codigo: code,
        nome: name,
        preco: priceInCents / 100,
        prazo: deliveryTime,
        gratis: free,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao calcular o frete.";
    const status = message.includes("inválido") ? 400 : message.includes("não encontrado") ? 404 : 502;
    return NextResponse.json({ erro: message }, { status });
  }
}
