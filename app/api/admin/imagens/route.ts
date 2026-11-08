import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, isValidAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ["image/webp", { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" }],
  ["image/avif", { extension: "avif", signature: (bytes: Uint8Array) => ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12))) }],
]);

export async function POST(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json({ erro: "Faça login para acessar esta área." }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return NextResponse.json({ erro: "Cada imagem pode ter no máximo 4 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envie um arquivo de imagem válido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ erro: "Selecione uma imagem para enviar." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ erro: "Cada imagem pode ter no máximo 4 MB." }, { status: 413 });
  }

  const imageType = allowedTypes.get(file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageType || !imageType.signature(bytes)) {
    return NextResponse.json({ erro: "Use uma imagem JPEG, PNG, WebP ou AVIF válida." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "product-images";
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { erro: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor para habilitar o envio de imagens." },
      { status: 503 },
    );
  }

  let storageUrl: URL;
  try {
    storageUrl = new URL(supabaseUrl);
  } catch {
    return NextResponse.json({ erro: "A configuração SUPABASE_URL é inválida." }, { status: 503 });
  }
  if (storageUrl.protocol !== "https:") {
    return NextResponse.json({ erro: "A configuração SUPABASE_URL deve usar HTTPS." }, { status: 503 });
  }

  const objectPath = `products/${randomUUID()}.${imageType.extension}`;
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");

  try {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": file.type,
        "x-upsert": "false",
      },
      body: bytes,
      cache: "no-store",
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Supabase Storage recusou o upload:", response.status, details);
      return NextResponse.json(
        { erro: response.status === 404
          ? `O bucket "${bucket}" não existe no Supabase Storage.`
          : "Não foi possível enviar a imagem ao Supabase Storage. Confira o bucket e as variáveis do servidor." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      imageUrl: `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Falha ao enviar imagem ao Supabase Storage:", error);
    return NextResponse.json({ erro: "Não foi possível conectar ao Supabase Storage." }, { status: 502 });
  }
}
