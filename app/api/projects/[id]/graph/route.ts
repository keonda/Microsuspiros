import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const [documents, storyNotes, researchNotes, resources, links] = await Promise.all([
    prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: false }, select: { id: true, title: true } }),
    prisma.storyNote.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.researchNote.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.resource.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.internalLink.findMany({ where: { projectId: id, targetId: { not: null } } })
  ]);
  const nodes = [
    ...documents.map((item) => ({ id: `DOCUMENT:${item.id}`, type: "DOCUMENT", title: item.title, href: `/projects/${id}/documents/${item.id}` })),
    ...storyNotes.map((item) => ({ id: `STORY_NOTE:${item.id}`, type: "STORY_NOTE", title: item.title, href: `/projects/${id}/notes#${item.id}` })),
    ...researchNotes.map((item) => ({ id: `RESEARCH_NOTE:${item.id}`, type: "RESEARCH_NOTE", title: item.title, href: `/projects/${id}/research#${item.id}` })),
    ...resources.map((item) => ({ id: `RESOURCE:${item.id}`, type: "RESOURCE", title: item.title, href: `/projects/${id}/resources#${item.id}` }))
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = links
    .map((link) => ({ source: `${link.sourceType}:${link.sourceId}`, target: `${link.targetType}:${link.targetId}`, label: link.rawText }))
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  return Response.json({ nodes, edges });
}
