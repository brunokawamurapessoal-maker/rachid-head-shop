import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [zones, settings] = await Promise.all([
      prisma.deliveryZone.findMany({
        where: { active: true },
        select: { name: true, postalCodeStart: true, postalCodeEnd: true },
        orderBy: [{ postalCodeStart: "asc" }, { postalCodeEnd: "asc" }],
      }),
      prisma.storeSettings.findUnique({
        where: { id: "main" },
        select: { whatsapp: true, city: true, state: true },
      }),
    ]);

    return NextResponse.json({
      zones: zones.map((zone) => ({ ...zone, name: zone.name.trim() })),
      store: {
        city: settings?.city || "Fortaleza",
        state: settings?.state || "CE",
      },
      whatsapp: settings?.whatsapp ?? "",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Falha ao carregar bairros cadastrados:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os bairros cadastrados." }, { status: 503 });
  }
}
