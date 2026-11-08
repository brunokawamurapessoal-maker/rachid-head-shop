import { createHmac, randomBytes, randomInt, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(callbackScrypt);
export const CUSTOMER_SESSION_COOKIE = "rachid-customer-session";
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function normalizeCpf(value: unknown) {
  if (typeof value !== "string") return null;
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return null;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(cpf[index]) * (length + 1 - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]) ? cpf : null;
}

function hmacPurpose(purpose: string, value: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("A segurança da área do cliente não está configurada.");
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}

export function hashCustomerCpf(cpf: string) {
  return hmacPurpose("customer-cpf", cpf);
}

export function hashRecoveryKey(purpose: "email" | "ip", value: string) {
  return hmacPurpose(`recovery-${purpose}`, value);
}

export function createRecoveryCode() {
  return String(randomInt(10_000_000, 100_000_000));
}

export function hashRecoveryCode(code: string) {
  return hmacPurpose("recovery-code", code);
}

export function safeHashEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function sessionSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

export async function verifyCustomerPassword(password: string, stored: string) {
  const [saltValue, hashValue, ...rest] = stored.split(".");
  if (!saltValue || !hashValue || rest.length) return false;
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createCustomerSession(customerId: string, sessionVersion: number) {
  const secret = sessionSecret();
  if (!secret) throw new Error("O acesso à área do cliente não está configurado.");
  const expiresAt = String(Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_MAX_AGE);
  const payload = `${customerId}.${sessionVersion}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

export async function getCustomerIdFromSession(request: NextRequest) {
  const secret = sessionSecret();
  const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!secret || !token) return null;

  const [customerId, sessionVersion, expiresAt, signature, ...rest] = token.split(".");
  if (!customerId || !sessionVersion || !expiresAt || !signature || rest.length ||
    !/^\d+$/.test(sessionVersion) || !/^\d+$/.test(expiresAt)) return null;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;

  const payload = `${customerId}.${sessionVersion}.${expiresAt}`;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { sessionVersion: true } });
  return customer?.sessionVersion === Number(sessionVersion) ? customerId : null;
}

export function isSameCustomerOrigin(request: NextRequest) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

export function setCustomerSessionCookie(response: import("next/server").NextResponse, customerId: string, sessionVersion: number) {
  response.cookies.set(CUSTOMER_SESSION_COOKIE, createCustomerSession(customerId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE,
  });
}
