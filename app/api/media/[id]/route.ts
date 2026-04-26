import { unlink } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { uploadRoot } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const file = await prisma.mediaFile.findFirst({ where: { id: params.id, userId: user.id } });
    if (!file) return apiError("File not found", 404);

    await prisma.mediaFile.delete({ where: { id: file.id } });

    const root = uploadRoot();
    const filePath = path.resolve(root, file.storageKey);
    if (filePath.startsWith(`${root}${path.sep}`)) {
      await unlink(filePath).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
