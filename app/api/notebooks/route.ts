import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
  position: z.number().int().optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const notebooks = await prisma.notebook.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      include: { notes: { orderBy: { position: "asc" }, select: { id: true, title: true } } }
    });
    return NextResponse.json({ notebooks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());
    const notebook = await prisma.notebook.create({
      data: { userId: user.id, title: body.title, parentId: body.parentId ?? undefined, position: body.position ?? 0 }
    });
    return NextResponse.json({ notebook });
  } catch (error) {
    return handleApiError(error);
  }
}
