import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = ["name", "legalName", "document", "email", "phone", "whatsapp", "postalCode", "address", "city", "state", "instagram"] as const;
type StoreField = (typeof fields)[number];
type StoreInput = Record<StoreField, string>;
type StoreSettingsRow = StoreInput & { id: string; updatedAt: Date };

async function getOrCreateSettings() {
  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "StoreSettings" ("id", "updatedAt") VALUES ('main', CURRENT_TIMESTAMP)
  `;
  const [settings] = await prisma.$queryRaw<StoreSettingsRow[]>`
    SELECT * FROM "StoreSettings" WHERE "id" = 'main'
  `;
  if (!settings) throw new Error("Os dados da empresa não foram encontrados após a criação.");
  return settings;
}

export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar dados da empresa:", error);
    return NextResponse.json({ erro: "Não foi possível carregar os dados da empresa." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie os dados em JSON válido." }, { status: 400 });
  }

  const values = {} as StoreInput;
  for (const field of fields) {
    const value = body[field];
    if (typeof value !== "string") {
      return NextResponse.json({ erro: "Preencha corretamente os dados da empresa." }, { status: 400 });
    }
    const trimmed = value.trim();
    if (trimmed.length > 200) {
      return NextResponse.json({ erro: "Cada campo pode ter no máximo 200 caracteres." }, { status: 400 });
    }
    values[field] = trimmed;
  }
  if (values.name.length < 2 || values.city.length < 2 || values.state.length !== 2) {
    return NextResponse.json({ erro: "Informe o nome da loja, a cidade e a UF com duas letras." }, { status: 400 });
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return NextResponse.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO "StoreSettings" (
        "id", "name", "legalName", "document", "email", "phone", "whatsapp",
        "postalCode", "address", "city", "state", "instagram", "updatedAt"
      ) VALUES (
        'main', ${values.name}, ${values.legalName}, ${values.document}, ${values.email},
        ${values.phone}, ${values.whatsapp}, ${values.postalCode}, ${values.address},
        ${values.city}, ${values.state}, ${values.instagram}, CURRENT_TIMESTAMP
      )
      ON CONFLICT("id") DO UPDATE SET
        "name" = excluded."name",
        "legalName" = excluded."legalName",
        "document" = excluded."document",
        "email" = excluded."email",
        "phone" = excluded."phone",
        "whatsapp" = excluded."whatsapp",
        "postalCode" = excluded."postalCode",
        "address" = excluded."address",
        "city" = excluded."city",
        "state" = excluded."state",
        "instagram" = excluded."instagram",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    const [settings] = await prisma.$queryRaw<StoreSettingsRow[]>`
      SELECT * FROM "StoreSettings" WHERE "id" = 'main'
    `;
    if (!settings) throw new Error("Os dados da empresa não foram encontrados após a atualização.");
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Falha ao atualizar dados da empresa:", error);
    return NextResponse.json({ erro: "Não foi possível salvar os dados da empresa." }, { status: 503 });
  }
}
