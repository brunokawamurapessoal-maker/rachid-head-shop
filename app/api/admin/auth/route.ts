import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isAdminConfigured,
  isSameOriginRequest,
  isValidAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: isValidAdminSession(request),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { erro: "Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no ambiente do servidor." },
      { status: 503 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Envie a senha em JSON válido." }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length > 256 || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ erro: "Origem da solicitação inválida." }, { status: 403 });
  }
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
