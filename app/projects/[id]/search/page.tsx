import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectSearchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { q = "" } = await searchParams;
  const query = q.trim();
  const contains = { contains: query, mode: "insensitive" as const };
  const [documents, storyNotes, researchNotes, cards, resources] =
    query.length >= 2
      ? await Promise.all([
          prisma.document.findMany({ where: { userId: user.id, projectId: id, isTrash: false, OR: [{ title: contains }, { plainText: contains }] }, take: 12 }),
          prisma.storyNote.findMany({ where: { userId: user.id, projectId: id, OR: [{ title: contains }, { body: contains }, { tagsText: contains }] }, take: 12 }),
          prisma.researchNote.findMany({ where: { userId: user.id, projectId: id, OR: [{ title: contains }, { summary: contains }, { personalNotes: contains }, { tagsText: contains }] }, take: 12 }),
          prisma.brainstormCard.findMany({ where: { userId: user.id, projectId: id, OR: [{ title: contains }, { body: contains }, { tagsText: contains }] }, take: 12 }),
          prisma.resource.findMany({ where: { userId: user.id, projectId: id, OR: [{ title: contains }, { originalName: contains }, { tagsText: contains }] }, take: 12 })
        ])
      : [[], [], [], [], []];

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Project Search</h1>
      <form className="mt-5 flex gap-2">
        <input className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 py-2" name="q" defaultValue={query} placeholder="Search this project..." />
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Search</button>
      </form>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Group title="Documents" items={documents.map((item) => ({ title: item.title, href: `/projects/${id}/documents/${item.id}` }))} />
        <Group title="Story Notes" items={storyNotes.map((item) => ({ title: item.title, href: `/projects/${id}/notes` }))} />
        <Group title="Research" items={researchNotes.map((item) => ({ title: item.title, href: `/projects/${id}/research` }))} />
        <Group title="Brainstorm" items={cards.map((item) => ({ title: item.title, href: `/projects/${id}/brainstorm` }))} />
        <Group title="Resources" items={resources.map((item) => ({ title: item.title, href: `/projects/${id}/resources` }))} />
      </div>
    </div>
  );
}

function Group({ title, items }: { title: string; items: { title: string; href: string }[] }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => <Link key={`${item.href}-${item.title}`} className="block rounded-md px-2 py-2 hover:bg-parchment" href={item.href}>{item.title}</Link>)}
        {!items.length ? <p className="text-sm text-stone-500">No matches.</p> : null}
      </div>
    </section>
  );
}
