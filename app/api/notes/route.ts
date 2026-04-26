import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/http";
import { extractWikiTitles } from "@/lib/notes";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(180),
  content: z.string().default(""),
  notebookId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).default([])
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

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const where = q
      ? {
          userId: user.id,
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { content: { contains: q, mode: "insensitive" as const } }
          ]
        }
      : { userId: user.id };
    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { tags: { include: { tag: true } }, notebook: true },
      take: 100
    });
    return NextResponse.json({ notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json());
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title: body.title,
        content: body.content,
        notebookId: body.notebookId ?? undefined
      }
    });
    await syncTags(user.id, note.id, body.tags);
    await syncLinks(user.id, note.id, body.content);
    return NextResponse.json({ note });
  } catch (error) {
    return handleApiError(error);
  }
}
