import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { isShippingCode, quoteShipping } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paymentMethods = ["pix", "cartao", "boleto", "dinheiro"] as const;
const money = (cents: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(cents / 100);

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const fullNumber = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(fullNumber) ? fullNumber : null;
}

export async function POST(request: NextRequest) {
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) return NextResponse.json({ erro: "Entre na sua conta antes de finalizar o pedido." }, { status: 401 });

  let body: { frete?: unknown; pagamento?: unknown; trocoPara?: unknown; itens?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados do pedido em JSON válido." }, { status: 400 });
  }
  if (
    !isShippingCode(body.frete) ||
    typeof body.pagamento !== "string" ||
    !paymentMethods.includes(body.pagamento as (typeof paymentMethods)[number]) ||
    !Array.isArray(body.itens) || body.itens.length < 1 || body.itens.length > 30
  ) {
    return NextResponse.json({ erro: "Confira os itens, a entrega e a forma de pagamento." }, { status: 400 });
  }
  const paymentMethod = body.pagamento as (typeof paymentMethods)[number];

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
    const [customer, store] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.storeSettings.findUnique({ where: { id: "main" } }),
    ]);
    if (!customer) return NextResponse.json({ erro: "Conta não encontrada. Entre novamente." }, { status: 401 });
    if (
      !/^\d{8}$/.test(customer.postalCode.replace(/\D/g, "")) ||
      !customer.address.trim() ||
      !customer.addressNumber.trim() ||
      !customer.neighborhood.trim()
    ) {
      return NextResponse.json({ erro: "Complete seu CEP e endereço na área do cliente antes de pedir." }, { status: 400 });
    }

    const whatsapp = store ? whatsappNumber(store.whatsapp) : null;
    if (!whatsapp) {
      return NextResponse.json({ erro: "A loja ainda não tem um WhatsApp válido. Configure-o em Admin → Dados da empresa." }, { status: 503 });
    }

    const requestedIds = [...new Set(requestedItems.map((item) => item.id as string))];
    const products = await prisma.product.findMany({
      where: { id: { in: requestedIds }, active: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = requestedItems.map((item) => {
      const product = productMap.get(item.id as string);
      if (!product) throw new Error("Um produto do pedido não está mais disponível.");
      const quantity = Number(item.quantidade);
      if (quantity > product.stock) throw new Error(`Estoque insuficiente para ${product.name}.`);
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPriceInCents: Math.max(1, Math.round(product.priceInCents * (100 - product.promotionPercent) / 100)),
        unitCostInCents: product.costInCents,
      };
    });

    const shippingQuote = await quoteShipping(customer.postalCode);
    const shippingOption = shippingQuote.options.find((option) => option.code === body.frete);
    if (!shippingOption) {
      return NextResponse.json({
        erro: body.frete === "LOCAL"
          ? `Ainda não há entrega local configurada para esse CEP. Confira o endereço ou escolha a entrega terceirizada.`
          : "Opção de entrega inválida.",
      }, { status: 400 });
    }
    if (customer.city && (
      customer.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() !==
      shippingQuote.address.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ||
      customer.state.toUpperCase() !== shippingQuote.address.state
    )) {
      return NextResponse.json({ erro: "O endereço salvo não corresponde ao CEP. Atualize os dados na área do cliente." }, { status: 409 });
    }

    const subtotalInCents = orderItems.reduce((sum, item) => sum + item.unitPriceInCents * item.quantity, 0);
    const discountInCents = paymentMethod === "pix" ? Math.round(subtotalInCents * 0.05) : 0;
    const totalBeforeShipping = subtotalInCents - discountInCents;
    const cashChangeForInCents = paymentMethod === "dinheiro" && typeof body.trocoPara === "number" &&
      Number.isFinite(body.trocoPara) && body.trocoPara > 0
      ? Math.round(body.trocoPara * 100)
      : 0;
    if (cashChangeForInCents > 0 && cashChangeForInCents < totalBeforeShipping) {
      return NextResponse.json({ erro: "O valor informado para troco deve cobrir ao menos o valor dos produtos." }, { status: 400 });
    }

    const shippingPending = shippingOption.quotePending;
    const shippingInCents = shippingOption.priceInCents;
    const totalInCents = subtotalInCents + shippingInCents - discountInCents;
    const order = await prisma.$transaction(async (transaction) => {
      for (const item of orderItems) {
        const updated = await transaction.product.updateMany({
          where: { id: item.productId, active: true, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new Error(`Estoque insuficiente para ${item.productName}.`);
      }
      return transaction.order.create({
        data: {
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          postalCode: shippingQuote.address.postalCode,
          address: customer.address,
          addressNumber: customer.addressNumber,
          neighborhood: customer.neighborhood,
          deliveryReference: customer.deliveryReference,
          city: shippingQuote.address.city,
          state: shippingQuote.address.state,
          shippingMethod: shippingOption.code,
          shippingPending,
          stockDeducted: true,
          inventoryTracked: true,
          paymentMethod,
          cashChangeForInCents,
          subtotalInCents,
          shippingInCents,
          discountInCents,
          totalInCents,
          items: { create: orderItems },
        },
      });
    });

    const paymentLabel = paymentMethod === "dinheiro"
      ? `Dinheiro${cashChangeForInCents ? ` (troco para ${money(cashChangeForInCents)})` : ""}`
      : paymentMethod.toUpperCase();
    const deliveryAddress = [
      `${customer.address}, ${customer.addressNumber}`,
      `Bairro: ${customer.neighborhood}`,
      `${shippingQuote.address.city} - ${shippingQuote.address.state}`,
      `CEP: ${shippingQuote.address.postalCode}`,
      customer.deliveryReference ? `Referência: ${customer.deliveryReference}` : "",
    ].filter(Boolean).join("\n");
    const orderSummary = [
      `NOVO PEDIDO #${order.id.slice(-4).toUpperCase()} – ${store?.name || "Rachid Head Shop"}`,
      `Cliente: ${customer.name}`,
      `Telefone: ${customer.phone}`,
      "Itens:",
      ...orderItems.map((item) => `• ${item.quantity}x ${item.productName} – ${money(item.unitPriceInCents * item.quantity)}`),
      `Entrega: ${shippingOption.code === "LOCAL" ? "Entrega local" : "Terceirizada (valor a combinar pelo WhatsApp)"}`,
      deliveryAddress,
      `Pagamento: ${paymentLabel}`,
      `Subtotal: ${money(subtotalInCents)}`,
      `Frete: ${shippingPending ? "A combinar pelo WhatsApp" : money(shippingInCents)}`,
      `${shippingPending ? "TOTAL (sem frete):" : "TOTAL:"} ${money(totalInCents)}`,
    ].join("\n");
    const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent(orderSummary)}`;

    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: order.totalInCents / 100,
      fretePendente: shippingPending,
      whatsappUrl,
      mensagem: "Pedido registrado. Abra o WhatsApp para enviar o resumo à loja.",
    }, { status: 201 });
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
