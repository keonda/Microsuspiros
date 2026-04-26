import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const tags = await prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { notes: true } } }
    });
    return NextResponse.json({ tags });
  } catch (error) {
    return handleApiError(error);
  }
}
