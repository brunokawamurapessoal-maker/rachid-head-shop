import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createRecoveryCode,
  hashCustomerCpf,
  hashCustomerPassword,
  hashRecoveryCode,
  hashRecoveryKey,
  isSameCustomerOrigin,
  normalizeCpf,
  safeHashEqual,
} from "@/lib/customer-auth";
import { isCustomerEmailConfigured, sendCustomerRecoveryCode } from "@/lib/customer-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const responseHeaders = { "Cache-Control": "no-store" };
const recoveryResponse = {
  mensagem: "Se os dados corresponderem a uma conta, enviaremos um código de segurança para o e-mail informado.",
};
const requestWindowMs = 15 * 60 * 1000;
const ipWindowMs = 60 * 60 * 1000;
const tokenWindowMs = 10 * 60 * 1000;
const maxCodeAttempts = 5;

function emailIsValid(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function POST(request: NextRequest) {
  if (!isSameCustomerOrigin(request)) {
    return json({ erro: "Origem da solicitação inválida." }, 403);
  }
  if (!process.env.CUSTOMER_SESSION_SECRET || process.env.CUSTOMER_SESSION_SECRET.length < 32) {
    return json({ erro: "A recuperação de conta ainda não está configurada." }, 503);
  }

  let body: { action?: unknown; email?: unknown; cpf?: unknown; code?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ erro: "Envie os dados em JSON válido." }, 400);
  }

  if (body.action === "request") {
    if (!emailIsValid(body.email)) {
      return json({ erro: "Informe um e-mail válido." }, 400);
    }
    if (!isCustomerEmailConfigured()) {
      return json({ erro: "O envio seguro de e-mails ainda não está configurado no servidor." }, 503);
    }

    try {
      const email = body.email.trim().toLowerCase();
      const emailHash = hashRecoveryKey("email", email);
      const ipHash = hashRecoveryKey("ip", requestIp(request));
      const now = new Date();
      const cpf = normalizeCpf(body.cpf);
      const recovery = await prisma.$transaction(async (transaction) => {
        await transaction.customerRecoveryRequest.deleteMany({
          where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        });
        const [emailRequests, ipRequests] = await Promise.all([
          transaction.customerRecoveryRequest.count({
            where: { emailHash, createdAt: { gte: new Date(now.getTime() - requestWindowMs) } },
          }),
          transaction.customerRecoveryRequest.count({
            where: { ipHash, createdAt: { gte: new Date(now.getTime() - ipWindowMs) } },
          }),
        ]);
        if (emailRequests >= 3 || ipRequests >= 10) return { limited: true as const };

        const customer = cpf ? await transaction.customer.findUnique({
          where: { email },
          select: { id: true, cpfHash: true },
        }) : null;
        const identityMatches = Boolean(
          customer?.cpfHash && cpf && safeHashEqual(customer.cpfHash, hashCustomerCpf(cpf)),
        );
        const code = identityMatches ? createRecoveryCode() : null;
        const reset = await transaction.customerRecoveryRequest.create({
          data: {
            customerId: identityMatches ? customer?.id : null,
            emailHash,
            ipHash,
            tokenHash: code ? hashRecoveryCode(code) : null,
            expiresAt: new Date(now.getTime() + tokenWindowMs),
          },
          select: { id: true },
        });
        return {
          limited: false as const,
          id: reset.id,
          customerId: identityMatches ? customer?.id : null,
          code,
        };
      });

      if (recovery.limited) return json(recoveryResponse, 202);
      if (recovery.customerId && recovery.code) {
        try {
          await sendCustomerRecoveryCode(email, recovery.code);
        } catch (mailError) {
          await prisma.customerRecoveryRequest.update({
            where: { id: recovery.id },
            data: { tokenHash: null, consumedAt: new Date() },
          });
          // Resposta idêntica à de "conta inexistente", para não revelar quais e-mails estão cadastrados.
          // O motivo real fica nos logs do servidor (Vercel → Logs).
          console.error("Falha ao enviar o código de recuperação por e-mail:", mailError);
        }
      }
      return json(recoveryResponse, 202);
    } catch (error) {
      console.error("Falha ao iniciar a recuperação da conta:", error);
      return json({ erro: "Não foi possível iniciar a recuperação agora." }, 503);
    }
  }

  if (body.action === "reset") {
    if (!emailIsValid(body.email) || typeof body.code !== "string" || !/^\d{8}$/.test(body.code)) {
      return json({ erro: "Código inválido ou expirado." }, 400);
    }
    if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256) {
      return json({ erro: "A nova senha deve ter entre 12 e 256 caracteres." }, 400);
    }

    try {
      const emailHash = hashRecoveryKey("email", body.email.trim().toLowerCase());
      const tokenHash = hashRecoveryCode(body.code);
      const now = new Date();
      const latestRequest = await prisma.customerRecoveryRequest.findFirst({
        where: {
          emailHash,
          tokenHash: { not: null },
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: maxCodeAttempts },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, customerId: true, tokenHash: true, attempts: true },
      });

      if (!latestRequest || !latestRequest.tokenHash ||
        !safeHashEqual(latestRequest.tokenHash, tokenHash) || !latestRequest.customerId) {
        if (latestRequest) {
          const attempts = latestRequest.attempts + 1;
          await prisma.customerRecoveryRequest.updateMany({
            where: { id: latestRequest.id, consumedAt: null, tokenHash: latestRequest.tokenHash },
            data: {
              attempts: { increment: 1 },
              ...(attempts >= maxCodeAttempts ? { tokenHash: null, consumedAt: now } : {}),
            },
          });
        }
        return json({ erro: "Código inválido ou expirado." }, 400);
      }

      const passwordHash = await hashCustomerPassword(body.password);
      const completed = await prisma.$transaction(async (transaction) => {
        const claimed = await transaction.customerRecoveryRequest.updateMany({
          where: {
            id: latestRequest.id,
            customerId: latestRequest.customerId,
            tokenHash: latestRequest.tokenHash,
            consumedAt: null,
            expiresAt: { gt: now },
            attempts: { lt: maxCodeAttempts },
          },
          data: { tokenHash: null, consumedAt: now },
        });
        if (claimed.count !== 1) return false;

        await transaction.customer.update({
          where: { id: latestRequest.customerId! },
          data: { passwordHash, sessionVersion: { increment: 1 } },
        });
        await transaction.customerRecoveryRequest.updateMany({
          where: { customerId: latestRequest.customerId, consumedAt: null },
          data: { tokenHash: null, consumedAt: now },
        });
        return true;
      });

      if (!completed) return json({ erro: "Código inválido ou expirado." }, 400);
      return json({ mensagem: "Senha redefinida. Entre com sua nova senha." });
    } catch (error) {
      console.error("Falha ao redefinir a senha do cliente:", error);
      return json({ erro: "Não foi possível redefinir a senha agora." }, 503);
    }
  }

  return json({ erro: "Ação de recuperação inválida." }, 400);
}
