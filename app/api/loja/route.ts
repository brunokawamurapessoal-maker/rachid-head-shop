import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.storeSettings.findUnique({
      where: { id: "main" },
      select: { name: true, whatsapp: true, city: true, state: true },
    });
    return NextResponse.json({
      name: settings?.name || "Rachid Head Shop",
      whatsapp: settings?.whatsapp || "",
      city: settings?.city || "Fortaleza",
      state: settings?.state || "CE",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar os dados públicos da loja:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os dados da loja." }, { status: 503 });
  }
}
