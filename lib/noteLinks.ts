import { extractWikiTitles } from "@/lib/notes";
import { prisma } from "@/lib/prisma";

export async function syncNoteLinks(userId: string, noteId: string, content: string) {
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
