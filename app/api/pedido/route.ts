import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isShippingCode, quoteShipping } from "@/lib/shipping";

export const runtime = "nodejs";

const paymentMethods = ["pix", "cartao", "boleto"] as const;

export async function POST(request: NextRequest) {
  let body: {
    nome?: unknown;
    email?: unknown;
    telefone?: unknown;
    cep?: unknown;
    frete?: unknown;
    pagamento?: unknown;
    itens?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados do pedido em JSON válido." }, { status: 400 });
  }

  if (
    typeof body.nome !== "string" || body.nome.trim().length < 2 || body.nome.length > 120 ||
    typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 ||
    typeof body.telefone !== "string" || body.telefone.replace(/\D/g, "").length < 10 ||
    typeof body.cep !== "string" ||
    !isShippingCode(body.frete) ||
    typeof body.pagamento !== "string" || !paymentMethods.includes(body.pagamento as (typeof paymentMethods)[number]) ||
    !Array.isArray(body.itens) || body.itens.length < 1 || body.itens.length > 30
  ) {
    return NextResponse.json({ erro: "Confira nome, e-mail, telefone, CEP, itens e forma de pagamento." }, { status: 400 });
  }

  const requestedItems: Array<{ id?: unknown; quantidade?: unknown }> = body.itens;
  if (requestedItems.some((item) =>
    typeof item.id !== "string" ||
    !Number.isInteger(item.quantidade) ||
    Number(item.quantidade) < 1 ||
    Number(item.quantidade) > 20
  )) {
    return NextResponse.json({ erro: "Um ou mais itens do pedido são inválidos." }, { status: 400 });
  }

  try {
    const ids = [...new Set(requestedItems.map((item) => item.id as string))];
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const orderItems = requestedItems.map((item) => {
      const product = productsById.get(item.id as string);
      if (!product) throw new Error("Um produto do pedido não está mais disponível.");
      const quantity = Number(item.quantidade);
      if (quantity > product.stock) throw new Error(`Estoque insuficiente para ${product.name}.`);
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPriceInCents: product.priceInCents,
      };
    });

    const subtotalInCents = orderItems.reduce(
      (sum, item) => sum + item.unitPriceInCents * item.quantity,
      0,
    );
    const shippingQuote = await quoteShipping(body.cep, subtotalInCents);
    const shipping = shippingQuote.options.find((option) => option.code === body.frete);
    if (!shipping) {
      return NextResponse.json({ erro: "Opção de frete inválida." }, { status: 400 });
    }

    const discountInCents = body.pagamento === "pix" ? Math.round(subtotalInCents * 0.05) : 0;
    const order = await prisma.order.create({
      data: {
        customerName: body.nome.trim(),
        customerEmail: body.email.trim().toLowerCase(),
        customerPhone: body.telefone.trim(),
        postalCode: shippingQuote.address.postalCode,
        city: shippingQuote.address.city,
        state: shippingQuote.address.state,
        shippingMethod: shipping.code,
        paymentMethod: body.pagamento,
        subtotalInCents,
        shippingInCents: shipping.priceInCents,
        discountInCents,
        totalInCents: subtotalInCents + shipping.priceInCents - discountInCents,
        items: { create: orderItems },
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        status: order.status,
        total: order.totalInCents / 100,
        mensagem: "Pedido registrado. A confirmação do pagamento ainda precisa ser feita com a loja.",
        pagamentoIntegrado: false,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar o pedido.";
    if (message.includes("não está mais disponível") || message.includes("Estoque insuficiente")) {
      return NextResponse.json({ erro: message }, { status: 409 });
    }
    if (message.includes("CEP inválido") || message.includes("CEP não encontrado")) {
      return NextResponse.json({ erro: message }, { status: 400 });
    }
    console.error("Falha ao registrar pedido:", error);
    return NextResponse.json({ erro: "Não foi possível registrar o pedido agora." }, { status: 503 });
  }
}
