import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  await requireUser();
  const body = z.object({ id: z.string(), title: z.string().min(1), body: z.string() }).parse(await request.json());
  const note = await prisma.note.update({ where: { id: body.id }, data: { title: body.title, body: body.body } });
  return NextResponse.json({ ok: true, updatedAt: note.updatedAt });
}
