import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  focusMode: z.boolean().optional(),
  editorMode: z.enum(["edit", "preview", "split"]).optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: body,
      create: { userId: user.id, ...body }
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
