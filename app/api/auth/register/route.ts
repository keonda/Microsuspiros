import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const userCount = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: await hashPassword(body.password),
        role: userCount === 0 ? "admin" : "user",
        settings: { create: {} },
        aiSettings: { create: {} }
      },
      select: { id: true, email: true, name: true, role: true }
    });
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
