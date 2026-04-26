import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || user.disabled) return apiError("Invalid credentials", 401);
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) return apiError("Invalid credentials", 401);
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
