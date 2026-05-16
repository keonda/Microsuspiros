import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const db = prisma as any;
  const { email, password } = await request.json();
  const submittedEmail = cleanEnvValue(email).toLowerCase();
  const submittedPassword = cleanEnvValue(password);

  if (singleUserModeEnabled()) {
    const expectedEmail = cleanEnvValue(process.env.SINGLE_USER_EMAIL ?? "attendant@example.com").toLowerCase();
    const expectedPassword = cleanEnvValue(process.env.SINGLE_USER_PASSWORD ?? "shiftcompanion");
    if (submittedEmail === expectedEmail && submittedPassword === expectedPassword) {
      return Response.json({ ok: true, mode: "single-user", email: expectedEmail });
    }
    return Response.json({ ok: false }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: submittedEmail } });
  if (!user?.passwordHash) return Response.json({ ok: false }, { status: 401 });
  const ok = await bcrypt.compare(submittedPassword, user.passwordHash);
  return ok ? Response.json({ ok: true, email: submittedEmail }) : Response.json({ ok: false }, { status: 401 });
}

function singleUserModeEnabled() {
  return cleanEnvValue(process.env.SINGLE_USER_MODE ?? "true").toLowerCase() !== "false";
}

function cleanEnvValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}
