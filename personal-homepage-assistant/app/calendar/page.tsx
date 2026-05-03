import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, Select, TextArea, TextInput } from "@/components/crud";
import { saveEvent } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item, projects] = await Promise.all([
    prisma.calendarEvent.findMany({ orderBy: { startsAt: "asc" }, include: { project: true } }),
    edit ? prisma.calendarEvent.findUnique({ where: { id: edit } }) : null,
    prisma.project.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <AppShell>
      <PageTitle title="Calendar" subtitle="Manual events, reminders, uploads, meetings, and personal dates." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveEvent} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Title" name="title" defaultValue={item?.title} required />
          <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Starts" name="startsAt" type="datetime-local" defaultValue={item?.startsAt ? item.startsAt.toISOString().slice(0, 16) : ""} required /><TextInput label="Ends" name="endsAt" type="datetime-local" defaultValue={item?.endsAt ? item.endsAt.toISOString().slice(0, 16) : ""} /></div>
          <Select label="Type" name="type" defaultValue={item?.type ?? "reminder"} options={["reminder", "content_idea", "upload", "meeting", "personal"]} />
          <label className="grid gap-1.5"><span className="label">Related project</span><select className="field" name="projectId" defaultValue={item?.projectId ?? ""}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <TextArea label="Description" name="description" defaultValue={item?.description} />
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update event" : "Create event"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((event) => <article key={event.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{event.title}</h2><p className="text-sm text-ink/55 dark:text-white/55">{event.startsAt.toLocaleString()} · {event.type.replace("_", " ")}</p></div><DeleteButton type="event" id={event.id} /></div><p className="my-3 line-clamp-3 text-sm">{event.description}</p><p className="text-xs text-ink/45 dark:text-white/45">{event.project?.name}</p><a className="btn btn-soft mt-3" href={`/calendar?edit=${event.id}`}>Edit</a></article>)}
        </div>
      </div>
    </AppShell>
  );
}
