import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromSession, hashCustomerCpf, isSameCustomerOrigin, normalizeCpf, safeHashEqual } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpfHash: true,
  postalCode: true,
  address: true,
  addressNumber: true,
  neighborhood: true,
  deliveryReference: true,
  city: true,
  state: true,
} as const;

export async function GET(request: NextRequest) {
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) return NextResponse.json({ erro: "Entre na sua conta para continuar." }, { status: 401 });
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: profileSelect });
  if (!customer) return NextResponse.json({ erro: "Conta não encontrada." }, { status: 404 });
  const { cpfHash, ...profile } = customer;
  return NextResponse.json({ customer: { ...profile, cpfRegistered: Boolean(cpfHash) } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isSameCustomerOrigin(request)) return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) return NextResponse.json({ erro: "Entre na sua conta para continuar." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados do perfil em JSON válido." }, { status: 400 });
  }

  const fields = ["name", "phone", "postalCode", "address", "addressNumber", "neighborhood", "deliveryReference", "city", "state"] as const;
  const values: Record<(typeof fields)[number], string> = {} as Record<(typeof fields)[number], string>;
  for (const field of fields) {
    if (typeof body[field] !== "string" || body[field].length > 200) {
      return NextResponse.json({ erro: "Confira os dados do perfil." }, { status: 400 });
    }
    values[field] = body[field].trim();
  }
  if (values.name.length < 2 || values.phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ erro: "Informe seu nome e telefone com DDD." }, { status: 400 });
  }
  if (!/^\d{8}$/.test(values.postalCode.replace(/\D/g, ""))) {
    return NextResponse.json({ erro: "Informe um CEP válido." }, { status: 400 });
  }
  if (values.address.length < 3 || !values.addressNumber || values.neighborhood.length < 2) {
    return NextResponse.json({ erro: "Informe rua, número e bairro para a entrega." }, { status: 400 });
  }
  if (values.city.length < 2 || values.state.length !== 2) {
    return NextResponse.json({ erro: "Consulte o CEP para preencher cidade e estado." }, { status: 400 });
  }

  try {
    const submittedCpf = body.cpf;
    const cpf = submittedCpf === undefined || submittedCpf === "" ? null : normalizeCpf(submittedCpf);
    if (submittedCpf !== undefined && submittedCpf !== "" && !cpf) {
      return NextResponse.json({ erro: "Informe um CPF válido." }, { status: 400 });
    }

    const existing = await prisma.customer.findUnique({ where: { id: customerId }, select: { cpfHash: true } });
    if (!existing) return NextResponse.json({ erro: "Conta não encontrada." }, { status: 404 });
    if (!existing.cpfHash && !cpf) {
      return NextResponse.json({ erro: "Informe seu CPF para habilitar a recuperação segura da conta." }, { status: 400 });
    }
    if (existing.cpfHash && cpf && !safeHashEqual(existing.cpfHash, hashCustomerCpf(cpf))) {
      return NextResponse.json({ erro: "O CPF já cadastrado não pode ser alterado pelo perfil." }, { status: 409 });
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { ...values, ...(!existing.cpfHash && cpf ? { cpfHash: hashCustomerCpf(cpf) } : {}) },
      select: profileSelect,
    });
    const { cpfHash, ...profile } = customer;
    return NextResponse.json({ customer: { ...profile, cpfRegistered: Boolean(cpfHash) } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ erro: "Não foi possível salvar esses dados. Confira as informações e tente novamente." }, { status: 409 });
    }
    console.error("Falha ao salvar perfil do cliente:", error);
    return NextResponse.json({ erro: "Não foi possível salvar o perfil agora." }, { status: 503 });
  }
}
