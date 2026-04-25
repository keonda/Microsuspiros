import { ProjectGraph } from "@/components/project-graph";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GraphPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return null;
  const [documents, storyNotes, researchNotes, resources, scenes, entities, links, unresolved] = await Promise.all([
    prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: false }, select: { id: true, title: true } }),
    prisma.storyNote.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.researchNote.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.resource.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true } }),
    prisma.scene.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, title: true, documentId: true } }),
    prisma.storyEntity.findMany({ where: { projectId: id, userId: user.id }, select: { id: true, name: true, _count: { select: { mentions: true } } } }),
    prisma.internalLink.findMany({ where: { projectId: id, targetId: { not: null } } }),
    prisma.internalLink.findMany({ where: { projectId: id, targetId: null } })
  ]);
  const nodes = [
    ...documents.map((item) => ({ id: `DOCUMENT:${item.id}`, type: "DOCUMENT", title: item.title, href: `/projects/${id}/documents/${item.id}` })),
    ...storyNotes.map((item) => ({ id: `STORY_NOTE:${item.id}`, type: "STORY_NOTE", title: item.title, href: `/projects/${id}/notes#${item.id}` })),
    ...researchNotes.map((item) => ({ id: `RESEARCH_NOTE:${item.id}`, type: "RESEARCH_NOTE", title: item.title, href: `/projects/${id}/research#${item.id}` })),
    ...resources.map((item) => ({ id: `RESOURCE:${item.id}`, type: "RESOURCE", title: item.title, href: `/projects/${id}/resources#${item.id}` })),
    ...scenes.map((item) => ({ id: `SCENE:${item.id}`, type: "SCENE", title: item.title, href: `/projects/${id}/documents/${item.documentId}` })),
    ...entities.map((item) => ({ id: `STORY_ENTITY:${item.id}`, type: "STORY_ENTITY", title: item.name, href: `/projects/${id}/insights#${item.id}` }))
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = links
    .map((link) => ({ source: `${link.sourceType}:${link.sourceId}`, target: `${link.targetType}:${link.targetId}`, label: link.rawText }))
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Project Graph</h1>
      <p className="mt-2 text-sm text-stone-600">A map of resolved wiki links, scenes, resources, and confirmed story entities.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Insight label="Unresolved links" value={unresolved.length} />
        <Insight label="Story entities" value={entities.length} />
        <Insight label="Scenes" value={scenes.length} />
      </div>
      <div className="mt-5">
        <ProjectGraph nodes={nodes} edges={edges} />
      </div>
      <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="font-serif text-2xl font-bold">Graph insights</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Most mentioned entities</h3>
            {entities.sort((a, b) => b._count.mentions - a._count.mentions).slice(0, 6).map((entity) => (
              <p key={entity.id} className="mt-2 text-sm text-[var(--muted-foreground)]">{entity.name} - {entity._count.mentions} mentions</p>
            ))}
          </div>
          <div>
            <h3 className="font-semibold">Open threads</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{unresolved.length} unresolved wiki links</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Review notes with no incoming links in project search.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
