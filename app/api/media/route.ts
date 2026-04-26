import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { allowedMimeTypes, maxUploadBytes, mediaFileUrl, uploadRoot } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const files = await prisma.mediaFile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return NextResponse.json({ files });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const noteId = z.string().optional().parse(form.get("noteId") || undefined);
    if (!(file instanceof File)) return apiError("File is required", 400);
    if (!allowedMimeTypes.has(file.type)) return apiError("File type is not allowed", 415);
    if (file.size > maxUploadBytes) return apiError("File is too large", 413);
    if (noteId) {
      const note = await prisma.note.findFirst({ where: { id: noteId, userId: user.id } });
      if (!note) return apiError("Note not found", 404);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).slice(0, 16);
    const filename = `${user.id}-${crypto.randomUUID()}${ext}`;
    await mkdir(uploadRoot(), { recursive: true });
    await writeFile(path.join(uploadRoot(), filename), bytes);

    const media = await prisma.mediaFile.create({
      data: {
        userId: user.id,
        noteId,
        filename,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey: filename,
        url: ""
      }
    });
    const mediaWithUrl = await prisma.mediaFile.update({
      where: { id: media.id },
      data: { url: mediaFileUrl(media.id) }
    });
    return NextResponse.json({ media: mediaWithUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
