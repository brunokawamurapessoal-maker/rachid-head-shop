import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "rachid-admin-session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export function isAdminConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.length >= 12 &&
    sessionSecret(),
  );
}

function sign(expiresAt: string, secret: string) {
  return createHmac("sha256", secret).update(expiresAt).digest("base64url");
}

export function createAdminSession() {
  const secret = sessionSecret();
  if (!secret) throw new Error("A sessão administrativa não está configurada.");
  const expiresAt = String(Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

export function isValidAdminSession(request: NextRequest) {
  const secret = sessionSecret();
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!secret || !token) return false;

  const [expiresAt, signature, ...rest] = token.split(".");
  if (!expiresAt || !signature || rest.length || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(expiresAt, secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isSameOriginRequest(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) return false;
  const expectedHash = createHmac("sha256", "rachid-admin-password").update(expected).digest();
  const actualHash = createHmac("sha256", "rachid-admin-password").update(password).digest();
  return timingSafeEqual(expectedHash, actualHash);
}
