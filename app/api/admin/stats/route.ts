import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const [users, notes, media, storage] = await Promise.all([
      prisma.user.count(),
      prisma.note.count(),
      prisma.mediaFile.count(),
      prisma.mediaFile.aggregate({ _sum: { sizeBytes: true } })
    ]);
    return NextResponse.json({
      stats: {
        users,
        notes,
        mediaFiles: media,
        storageBytes: storage._sum.sizeBytes ?? 0
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
