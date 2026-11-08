import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const answers: Array<[RegExp, string]> = [
  [/hor[aá]rio|abre|funciona/i, "A loja física fica em Fortaleza e funciona de segunda a sábado, das 10h às 20h. O atendimento online está disponível por aqui."],
  [/frete|entrega|prazo/i, "Consulte o prazo e os valores na seção “Calcule seu frete” usando o CEP de destino. As estimativas são calculadas por região."],
  [/pagamento|pix|cart[aã]o|boleto/i, "Você pode registrar um pedido escolhendo a forma de pagamento. A confirmação financeira precisa ser feita manualmente: o site ainda não está integrado a um intermediador."],
  [/troca|devolu[cç][aã]o/i, "Trocas e devoluções podem ser solicitadas em até 7 dias após o recebimento, com o produto intacto. Entre em contato com a loja para combinar."],
  [/whats|contato/i, "WhatsApp da loja: (85) 99999-0000."],
  [/produto|cat[aá]logo|estoque/i, "Confira os produtos e a disponibilidade atual na seção Catálogo. O estoque exibido é carregado do banco de dados da loja."],
];

export async function POST(request: NextRequest) {
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie uma mensagem válida." }, { status: 400 });
  }

  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 500) {
    return NextResponse.json({ erro: "A mensagem deve ter entre 1 e 500 caracteres." }, { status: 400 });
  }

  const message = body.message;
  const answer = answers.find(([pattern]) => pattern.test(message))?.[1]
    ?? "Posso ajudar com horários, catálogo, pagamentos, frete e trocas. Se precisar de atendimento pessoal, fale com a loja pelo WhatsApp: (85) 99999-0000.";

  return NextResponse.json({ resposta: answer });
}
