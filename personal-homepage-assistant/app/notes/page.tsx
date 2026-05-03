import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, TextArea, TextInput } from "@/components/crud";
import { saveNote } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item, projects] = await Promise.all([
    prisma.note.findMany({ orderBy: { updatedAt: "desc" }, include: { project: true } }),
    edit ? prisma.note.findUnique({ where: { id: edit } }) : null,
    prisma.project.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <AppShell>
      <PageTitle title="Notes" subtitle="Markdown notes with autosave-ready editing and project relationships." />
      <div className="grid gap-4 xl:grid-cols-[460px_1fr]">
        <form action={saveNote} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Title" name="title" defaultValue={item?.title} required />
          <label className="grid gap-1.5"><span className="label">Related project</span><select className="field" name="projectId" defaultValue={item?.projectId ?? ""}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <TextArea label="Markdown body" name="body" rows={12} defaultValue={item?.body} />
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update note" : "Create note"}</button>
        </form>
        <div className="grid gap-3">
          {items.map((note) => <article key={note.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{note.title}</h2><p className="text-sm text-ink/55 dark:text-white/55">{note.project?.name ?? "No project"} · {note.updatedAt.toLocaleString()}</p></div><DeleteButton type="note" id={note.id} /></div><p className="my-3 line-clamp-4 whitespace-pre-wrap text-sm">{note.body}</p><a className="btn btn-soft" href={`/notes?edit=${note.id}`}>Edit</a></article>)}
        </div>
      </div>
    </AppShell>
  );
}
