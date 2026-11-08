import { NextRequest, NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cep = request.nextUrl.searchParams.get("cep") ?? "";
  try {
    const quote = await quoteShipping(cep);
    return NextResponse.json({
      ...quote.address,
      loja: quote.store,
      opcoes: quote.options.map(({ code, name, priceInCents, deliveryTime, free, quotePending }) => ({
        codigo: code,
        nome: name,
        preco: priceInCents / 100,
        prazo: deliveryTime,
        gratis: free,
        cotacaoPendente: quotePending,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao calcular o frete.";
    const status = message.includes("inválido") ? 400 : message.includes("não encontrado") ? 404 : 502;
    return NextResponse.json({ erro: message }, { status });
  }
}
