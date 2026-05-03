import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
  await prisma.chatConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true, deletedId: id });
}
