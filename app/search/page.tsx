import Link from "next/link";
import { searchEverything } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query.length >= 2 ? await searchEverything(user.id, query) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-bold">Global Search</h1>
      <form className="mt-5 flex gap-2">
        <input className="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-3 py-2" name="q" defaultValue={query} placeholder="Search projects, documents, notes, research, cards, resources..." />
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Search</button>
      </form>
      {results ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Group title="Projects" items={results.projects.map((item) => ({ title: item.title, href: `/projects/${item.id}` }))} />
          <Group title="Documents" items={results.documents.map((item) => ({ title: item.title, href: `/projects/${item.projectId}/documents/${item.id}` }))} />
          <Group title="Story Notes" items={results.storyNotes.map((item) => ({ title: item.title, href: `/projects/${item.projectId}/notes` }))} />
          <Group title="Research" items={results.researchNotes.map((item) => ({ title: item.title, href: `/projects/${item.projectId}/research` }))} />
          <Group title="Brainstorm Cards" items={results.cards.map((item) => ({ title: item.title, href: `/projects/${item.projectId}/brainstorm` }))} />
          <Group title="Resources" items={results.resources.map((item) => ({ title: item.title, href: `/projects/${item.projectId}/resources` }))} />
        </div>
      ) : (
        <p className="mt-5 text-stone-600">Enter at least two characters.</p>
      )}
    </main>
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

// TODO: Backlinks graph should build from document/note/resource references and surface beside search.
