import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { uploadRoot } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const file = await prisma.mediaFile.findFirst({
      where: { id: params.id, userId: user.id }
    });
    if (!file) return apiError("File not found", 404);

    const root = uploadRoot();
    const filePath = path.resolve(root, file.storageKey);
    if (!filePath.startsWith(`${root}${path.sep}`)) return apiError("Invalid file path", 400);

    const info = await stat(filePath);
    const stream = Readable.toWeb(createReadStream(filePath));

    return new NextResponse(stream as BodyInit, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
