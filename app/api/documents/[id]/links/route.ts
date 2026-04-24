import { requireUser } from "@/lib/auth";
import { linkCandidates } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

  const [outgoing, backlinks, candidates] = await Promise.all([
    prisma.internalLink.findMany({ where: { projectId: document.projectId, sourceType: "DOCUMENT", sourceId: id }, orderBy: { createdAt: "desc" } }),
    prisma.internalLink.findMany({ where: { projectId: document.projectId, targetType: "DOCUMENT", targetId: id }, orderBy: { createdAt: "desc" } }),
    linkCandidates(prisma, document.projectId)
  ]);

  const titledBacklinks = await withSourceTitles(document.projectId, backlinks);
  return Response.json({
    outgoing: outgoing.map((link) => ({ ...link, href: hrefFor(candidates, link.targetType, link.targetId) })),
    backlinks: titledBacklinks,
    unresolved: outgoing.filter((link) => !link.targetId)
  });
}

async function withSourceTitles(projectId: string, links: Awaited<ReturnType<typeof prisma.internalLink.findMany>>) {
  const idsByType = new Map<string, string[]>();
  for (const link of links) idsByType.set(link.sourceType, [...(idsByType.get(link.sourceType) || []), link.sourceId]);
  const [documents, storyNotes, researchNotes, cards] = await Promise.all([
    prisma.document.findMany({ where: { projectId, id: { in: idsByType.get("DOCUMENT") || [] } }, select: { id: true, title: true, projectId: true } }),
    prisma.storyNote.findMany({ where: { projectId, id: { in: idsByType.get("STORY_NOTE") || [] } }, select: { id: true, title: true, projectId: true } }),
    prisma.researchNote.findMany({ where: { projectId, id: { in: idsByType.get("RESEARCH_NOTE") || [] } }, select: { id: true, title: true, projectId: true } }),
    prisma.brainstormCard.findMany({ where: { projectId, id: { in: idsByType.get("BRAINSTORM_CARD") || [] } }, select: { id: true, title: true, projectId: true } })
  ]);
  const sources = new Map<string, { title: string; href: string }>();
  for (const item of documents) sources.set(`DOCUMENT:${item.id}`, { title: item.title, href: `/projects/${item.projectId}/documents/${item.id}` });
  for (const item of storyNotes) sources.set(`STORY_NOTE:${item.id}`, { title: item.title, href: `/projects/${item.projectId}/notes#${item.id}` });
  for (const item of researchNotes) sources.set(`RESEARCH_NOTE:${item.id}`, { title: item.title, href: `/projects/${item.projectId}/research#${item.id}` });
  for (const item of cards) sources.set(`BRAINSTORM_CARD:${item.id}`, { title: item.title, href: `/projects/${item.projectId}/brainstorm#${item.id}` });
  return links.map((link) => ({ ...link, sourceTitle: sources.get(`${link.sourceType}:${link.sourceId}`)?.title || "Untitled", href: sources.get(`${link.sourceType}:${link.sourceId}`)?.href || "#" }));
}

function hrefFor(candidates: Awaited<ReturnType<typeof linkCandidates>>, targetType: string | null, targetId: string | null) {
  if (!targetType || !targetId) return null;
  return candidates.find((candidate) => candidate.type === targetType && candidate.id === targetId)?.href || null;
}
