import { createResearchNoteAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const notes = await prisma.researchNote.findMany({ where: { projectId: id, userId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Research</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createResearchNoteAction.bind(null, id)} className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-xl font-bold">New research note</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="title" placeholder="Title" required />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="sourceTitle" placeholder="Source title" />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="sourceUrl" placeholder="https://..." />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="author" placeholder="Author" />
            <textarea className="min-h-24 w-full rounded-md border border-stone-200 px-3 py-2" name="excerpt" placeholder="Quote / excerpt" />
            <textarea className="min-h-24 w-full rounded-md border border-stone-200 px-3 py-2" name="summary" placeholder="Summary" />
            <textarea className="min-h-24 w-full rounded-md border border-stone-200 px-3 py-2" name="personalNotes" placeholder="Personal notes" />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="tagsText" placeholder="tags, comma-separated" />
          </div>
          <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Create research note</button>
        </form>
        <div className="space-y-4">
          {notes.map((note) => (
            <article key={note.id} className="rounded-xl bg-paper p-5 ring-1 ring-stone-200">
              <h2 className="font-serif text-2xl font-bold">{note.title}</h2>
              <p className="mt-1 text-sm text-stone-500">{note.author || "Unknown author"} {note.sourceTitle ? `- ${note.sourceTitle}` : ""}</p>
              {note.sourceUrl ? <a className="mt-2 inline-block text-sm font-medium text-cedar" href={note.sourceUrl} target="_blank">Open source</a> : null}
              {note.excerpt ? <blockquote className="mt-4 border-l-4 border-cedar/40 pl-4 font-serif text-stone-700">{note.excerpt}</blockquote> : null}
              {note.summary ? <p className="mt-4 leading-7 text-stone-700">{note.summary}</p> : null}
              {note.personalNotes ? <p className="mt-3 leading-7 text-stone-600">{note.personalNotes}</p> : null}
              {note.tagsText ? <p className="mt-3 text-xs text-cedar">{note.tagsText}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
