import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/http";
import { extractWikiTitles } from "@/lib/notes";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  content: z.string().optional(),
  notebookId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
  createVersion: z.boolean().default(false)
});

async function syncLinks(userId: string, noteId: string, content: string) {
  const titles = extractWikiTitles(content);
  await prisma.noteLink.deleteMany({ where: { sourceNoteId: noteId } });
  for (const title of titles) {
    const target = await prisma.note.findFirst({
      where: { userId, title: { equals: title, mode: "insensitive" } },
      select: { id: true }
    });
    await prisma.noteLink.create({
      data: { userId, sourceNoteId: noteId, targetNoteId: target?.id, targetTitle: title }
    });
  }
}

async function syncTags(userId: string, noteId: string, tags: string[]) {
  await prisma.noteTag.deleteMany({ where: { noteId } });
  for (const raw of tags) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name }
    });
    await prisma.noteTag.create({ data: { noteId, tagId: tag.id } });
  }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const note = await prisma.note.findFirst({
      where: { id: params.id, userId: user.id },
      include: {
        tags: { include: { tag: true } },
        outgoing: true,
        incoming: { include: { sourceNote: { select: { id: true, title: true } } } },
        versions: { orderBy: { createdAt: "desc" }, take: 10 }
      }
    });
    if (!note) return apiError("Note not found", 404);
    return NextResponse.json({ note });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = updateSchema.parse(await request.json());
    const existing = await prisma.note.findFirst({ where: { id: params.id, userId: user.id } });
    if (!existing) return apiError("Note not found", 404);
    if (body.createVersion) {
      await prisma.noteVersion.create({
        data: { userId: user.id, noteId: existing.id, title: existing.title, content: existing.content }
      });
    }
    const note = await prisma.note.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        content: body.content,
        notebookId: body.notebookId === undefined ? undefined : body.notebookId
      }
    });
    if (body.tags) await syncTags(user.id, note.id, body.tags);
    await syncLinks(user.id, note.id, body.content ?? note.content);
    return NextResponse.json({ note });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const note = await prisma.note.findFirst({ where: { id: params.id, userId: user.id } });
    if (!note) return apiError("Note not found", 404);
    await prisma.note.delete({ where: { id: note.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
