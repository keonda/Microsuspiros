import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashToken, makeSignedCookie, verifySignedCookie } from "@/lib/crypto";

export const sessionCookieName = "pha_session";

export async function hasAdminUser() {
  return (await prisma.user.count()) > 0;
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  });

  const signed = await makeSignedCookie(token);
  (await cookies()).set(sessionCookieName, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = await verifySignedCookie(cookieStore.get(sessionCookieName)?.value);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function requireUser() {
  if (!(await hasAdminUser())) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function logout() {
  "use server";
  const cookieStore = await cookies();
  const token = await verifySignedCookie(cookieStore.get(sessionCookieName)?.value);
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
