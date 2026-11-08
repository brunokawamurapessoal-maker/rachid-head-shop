import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  getCustomerIdFromSession,
  hashCustomerCpf,
  hashCustomerPassword,
  isSameCustomerOrigin,
  normalizeCpf,
  verifyCustomerPassword,
} from "@/lib/customer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const customerId = await getCustomerIdFromSession(request);
  if (!customerId) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!customer) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ authenticated: true, customer }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameCustomerOrigin(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!process.env.CUSTOMER_SESSION_SECRET || process.env.CUSTOMER_SESSION_SECRET.length < 32) {
    return NextResponse.json({ erro: "A área do cliente ainda não está configurada." }, { status: 503 });
  }

  let body: { action?: unknown; name?: unknown; email?: unknown; phone?: unknown; cpf?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados em JSON válido." }, { status: 400 });
  }

  if (typeof body.action !== "string" || (body.action !== "register" && body.action !== "login")) {
    return NextResponse.json({ erro: "Selecione entrar ou criar conta." }, { status: 400 });
  }
  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254) {
    return NextResponse.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256) {
    return NextResponse.json({ erro: "A senha deve ter entre 12 e 256 caracteres." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  try {
    let customer;
    if (body.action === "register") {
      if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.length > 120) {
        return NextResponse.json({ erro: "Informe seu nome completo." }, { status: 400 });
      }
      if (typeof body.phone !== "string" || body.phone.replace(/\D/g, "").length < 10 || body.phone.length > 30) {
        return NextResponse.json({ erro: "Informe um telefone com DDD." }, { status: 400 });
      }
      const cpf = normalizeCpf(body.cpf);
      if (!cpf) {
        return NextResponse.json({ erro: "Informe um CPF válido." }, { status: 400 });
      }
      customer = await prisma.customer.create({
        data: {
          name: body.name.trim(),
          email,
          phone: body.phone.trim(),
          passwordHash: await hashCustomerPassword(body.password),
          cpfHash: hashCustomerCpf(cpf),
        },
        select: { id: true, name: true, email: true, phone: true, sessionVersion: true },
      });
    } else {
      const existing = await prisma.customer.findUnique({ where: { email } });
      if (!existing || !(await verifyCustomerPassword(body.password, existing.passwordHash))) {
        return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
      }
      customer = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        sessionVersion: existing.sessionVersion,
      };
    }

    const response = NextResponse.json({
      authenticated: true,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, createCustomerSession(customer.id, customer.sessionVersion), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ erro: "Não foi possível criar a conta com esses dados. Confira as informações ou faça login." }, { status: 409 });
    }
    console.error("Falha na autenticação do cliente:", error);
    return NextResponse.json({ erro: "Não foi possível acessar a conta agora." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameCustomerOrigin(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
