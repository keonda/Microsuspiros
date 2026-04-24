import type { Document, PrismaClient } from "@prisma/client";

export const VERSION_INTERVAL_MS = 12 * 60 * 1000;

export async function createDocumentVersion(
  prisma: PrismaClient,
  document: Pick<Document, "id" | "userId" | "title" | "contentJson" | "contentHtml" | "plainText" | "wordCount">,
  changeSummary?: string
) {
  return prisma.documentVersion.create({
    data: {
      documentId: document.id,
      userId: document.userId,
      titleSnapshot: document.title,
      contentJsonSnapshot: document.contentJson ?? undefined,
      contentHtmlSnapshot: document.contentHtml,
      plainTextSnapshot: document.plainText,
      wordCountSnapshot: document.wordCount,
      changeSummary
    }
  });
}

export async function shouldCreateTimedVersion(prisma: PrismaClient, documentId: string) {
  const latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  return !latest || Date.now() - latest.createdAt.getTime() > VERSION_INTERVAL_MS;
}
