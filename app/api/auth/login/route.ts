import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const db = prisma as any;
  const { email, password } = await request.json();

  if (process.env.SINGLE_USER_MODE === "true") {
    const expectedEmail = process.env.SINGLE_USER_EMAIL ?? "attendant@example.com";
    const expectedPassword = process.env.SINGLE_USER_PASSWORD ?? "shiftcompanion";
    if (email === expectedEmail && password === expectedPassword) {
      return Response.json({ ok: true, mode: "single-user", email });
    }
    return Response.json({ ok: false }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return Response.json({ ok: false }, { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? Response.json({ ok: true, email }) : Response.json({ ok: false }, { status: 401 });
}
