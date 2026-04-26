import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const cookieName = "microsuspiros_session";

function useSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE) {
    return process.env.AUTH_COOKIE_SECURE === "true";
  }
  return process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSession() {
  cookies().delete(cookieName);
}

export async function getCurrentUser() {
  const token = cookies().get(cookieName)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret());
    const userId = verified.payload.userId;
    if (typeof userId !== "string") return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, disabled: true }
    });
    if (!user || user.disabled) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
