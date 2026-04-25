import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return null;
  const [documents, scenes, storyNotes, researchNotes, resources, unresolvedLinks, entities, recentDocuments] = await Promise.all([
    prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: false }, select: { wordCount: true, title: true } }),
    prisma.scene.count({ where: { projectId: id, userId: user.id } }),
    prisma.storyNote.count({ where: { projectId: id, userId: user.id } }),
    prisma.researchNote.count({ where: { projectId: id, userId: user.id } }),
    prisma.resource.count({ where: { projectId: id, userId: user.id } }),
    prisma.internalLink.count({ where: { projectId: id, targetId: null } }),
    prisma.storyEntity.findMany({ where: { projectId: id, userId: user.id }, include: { _count: { select: { mentions: true } } }, orderBy: { name: "asc" } }),
    prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: false }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true } })
  ]);
  const totalWords = documents.reduce((sum, doc) => sum + doc.wordCount, 0);
  const linkedTargets = await prisma.internalLink.findMany({ where: { projectId: id, targetId: { not: null } }, select: { targetType: true, targetId: true } });
  const linkedNoteIds = new Set(linkedTargets.filter((link) => link.targetType === "STORY_NOTE" || link.targetType === "RESEARCH_NOTE").map((link) => link.targetId));

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Story Health</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">A compact read on structure, links, entities, and recent writing activity.</p>
      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <Stat label="Total words" value={totalWords} />
        <Stat label="Documents" value={documents.length} />
        <Stat label="Scenes" value={scenes} />
        <Stat label="Notes" value={storyNotes + researchNotes} />
        <Stat label="Resources" value={resources} />
        <Stat label="Linked notes" value={linkedNoteIds.size} />
        <Stat label="Unresolved links" value={unresolvedLinks} />
        <Stat label="Entities" value={entities.length} />
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-serif text-2xl font-bold">Most mentioned characters and terms</h2>
          {entities.sort((a, b) => b._count.mentions - a._count.mentions).slice(0, 8).map((entity) => (
            <p id={entity.id} key={entity.id} className="mt-3 text-sm text-[var(--muted-foreground)]">
              <strong className="text-[var(--foreground)]">{entity.name}</strong> - {entity.type.toLowerCase()} - {entity._count.mentions} mentions
            </p>
          ))}
          {!entities.length ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">No confirmed entities yet. Use the editor Entities panel to detect candidates.</p> : null}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-serif text-2xl font-bold">Recent writing activity</h2>
          {recentDocuments.map((document) => (
            <p key={document.id} className="mt-3 text-sm text-[var(--muted-foreground)]">
              <strong className="text-[var(--foreground)]">{document.title}</strong> - {document.updatedAt.toLocaleString()}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
