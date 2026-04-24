import { requireUser } from "@/lib/auth";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await requireUser();
  const { versionId } = await params;
  const version = await prisma.documentVersion.findFirst({ where: { id: versionId, userId: user.id }, include: { document: true } });
  if (!version) return Response.json({ error: "Version not found." }, { status: 404 });
  const maxOrder = await prisma.document.aggregate({ where: { projectId: version.document.projectId, userId: user.id }, _max: { sortOrder: true } });
  const duplicate = await prisma.document.create({
    data: {
      title: `${version.titleSnapshot} (Version copy)`,
      contentJson: version.contentJsonSnapshot as never,
      contentHtml: version.contentHtmlSnapshot,
      plainText: version.plainTextSnapshot,
      wordCount: version.wordCountSnapshot,
      charCount: version.plainTextSnapshot.length,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      projectId: version.document.projectId,
      userId: user.id
    }
  });
  await syncInternalLinks(prisma, { projectId: duplicate.projectId, sourceType: "DOCUMENT", sourceId: duplicate.id, text: `${duplicate.title}\n${duplicate.plainText}` });
  return Response.json({ ok: true, documentId: duplicate.id, projectId: duplicate.projectId });
}
