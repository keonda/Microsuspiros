import { requireUser } from "@/lib/auth";
import { createDocumentVersion } from "@/lib/document-versions";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;
  const version = await prisma.documentVersion.findFirst({ where: { id: versionId, userId: user.id } });
  if (!version) return Response.json({ error: "Version not found." }, { status: 404 });
  const document = await prisma.document.findFirst({ where: { id: version.documentId, userId: user.id } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

  await createDocumentVersion(prisma, document, "Before restoring version");
  const restored = await prisma.document.update({
    where: { id: document.id },
    data: {
      title: version.titleSnapshot,
      contentJson: version.contentJsonSnapshot as never,
      contentHtml: version.contentHtmlSnapshot,
      plainText: version.plainTextSnapshot,
      wordCount: version.wordCountSnapshot,
      charCount: version.plainTextSnapshot.length
    }
  });
  await syncInternalLinks(prisma, { projectId: restored.projectId, sourceType: "DOCUMENT", sourceId: restored.id, text: `${restored.title}\n${restored.plainText}` });
  return Response.json({ ok: true, documentId: restored.id, projectId: restored.projectId });
}
