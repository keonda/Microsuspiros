import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.string(),
  role: z.enum(["user", "admin"]).optional(),
  disabled: z.boolean().optional()
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabled: true,
        createdAt: true,
        _count: { select: { notes: true, mediaFiles: true } }
      }
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: body.userId },
      data: {
        role: body.userId === admin.id ? undefined : body.role,
        disabled: body.userId === admin.id ? false : body.disabled
      },
      select: { id: true, email: true, role: true, disabled: true }
    });
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
