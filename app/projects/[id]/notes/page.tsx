import { createStoryNoteAction, updateStoryNoteAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/format";

const noteTypes = ["CHARACTER", "LOCATION", "SCENE_IDEA", "PLOT_THREAD", "TIMELINE_NOTE", "WORLDBUILDING", "GENERAL"];

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const notes = await prisma.storyNote.findMany({ where: { projectId: id, userId: user.id }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Story Notes</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <form action={createStoryNoteAction.bind(null, id)} className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-xl font-bold">New note</h2>
          <Fields />
          <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Create note</button>
        </form>
        <div className="grid gap-4 lg:grid-cols-2">
          {notes.map((note) => (
            <form key={note.id} action={updateStoryNoteAction.bind(null, id, note.id)} className="rounded-xl bg-paper p-5 ring-1 ring-stone-200">
              <Fields note={note} />
              <button className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">Save</button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fields({ note }: { note?: { title: string; type: string; body: string; tagsText: string } }) {
  return (
    <div className="mt-4 space-y-3">
      <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="title" defaultValue={note?.title} placeholder="Title" required />
      <select className="w-full rounded-md border border-stone-200 px-3 py-2" name="type" defaultValue={note?.type || "GENERAL"}>
        {noteTypes.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}
      </select>
      <textarea className="min-h-40 w-full rounded-md border border-stone-200 px-3 py-2" name="body" defaultValue={note?.body} placeholder="Body" />
      <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="tagsText" defaultValue={note?.tagsText} placeholder="tags, comma-separated" />
    </div>
  );
}
