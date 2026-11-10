import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCustomerEmailConfigured } from "@/lib/customer-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Só indica se as variáveis SMTP existem e são válidas; nunca devolve os valores.
  const email = isCustomerEmailConfigured() ? "configured" : "not_configured";
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected", email });
  } catch (error) {
    console.error("Health check do banco falhou:", error);
    return NextResponse.json(
      { status: "error", database: "unavailable", email },
      { status: 503 },
    );
  }
}
