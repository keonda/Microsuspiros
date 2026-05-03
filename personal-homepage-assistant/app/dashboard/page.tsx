import Link from "next/link";
import { Bot, CheckCircle2, ExternalLink, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { completeTask } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const now = new Date();
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const [links, projects, events, tasks, notes, activity] = await Promise.all([
    prisma.quickLink.findMany({ where: { OR: [{ favorite: true }, { pinned: true }] }, orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }], take: 8 }),
    prisma.project.findMany({ where: { status: "active" }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 6 }),
    prisma.calendarEvent.findMany({ where: { startsAt: { gte: now, lte: soon } }, orderBy: { startsAt: "asc" }, take: 6 }),
    prisma.task.findMany({ where: { status: { not: "done" } }, orderBy: [{ dueDate: "asc" }, { priority: "desc" }], take: 6, include: { project: true } }),
    prisma.note.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { project: true } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  return (
    <AppShell>
      <section className="mb-6 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <div className="card">
          <p className="badge mb-4 inline-block">Today</p>
          <h1 className="text-4xl font-bold tracking-tight">Good place to begin.</h1>
          <p className="mt-2 max-w-2xl text-ink/62 dark:text-white/62">Your active projects, near-term calendar, unfinished tasks, and notes are all gathered here so the next move feels less scattered.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/assistant"><Bot size={16} /> Ask assistant</Link>
            <Link className="btn btn-soft" href="/projects"><Plus size={16} /> Add project</Link>
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Pinned links</h2>
          <div className="space-y-2">
            {links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-sm font-semibold hover:bg-ink/10 dark:bg-white/10">
                {link.name}<ExternalLink size={15} />
              </a>
            ))}
            {links.length === 0 && <p className="text-sm text-ink/55 dark:text-white/55">Favorite quick links will land here.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-3 font-bold">Active projects</h2>
          <div className="space-y-3">
            {projects.map((project) => (
              <Link href="/projects" key={project.id} className="block rounded-xl bg-ink/5 p-3 dark:bg-white/10">
                <div className="flex items-center justify-between gap-2"><strong>{project.name}</strong><span className="badge">{project.priority}</span></div>
                <p className="mt-1 line-clamp-2 text-sm text-ink/58 dark:text-white/58">{project.description}</p>
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Today’s tasks</h2>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-xl bg-ink/5 p-3 dark:bg-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div><strong>{task.title}</strong><p className="text-xs text-ink/55 dark:text-white/55">{task.project?.name ?? task.priority}</p></div>
                  <form action={completeTask}><input type="hidden" name="id" value={task.id} /><button className="text-moss" title="Complete"><CheckCircle2 size={20} /></button></form>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Upcoming events</h2>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-xl bg-ink/5 p-3 dark:bg-white/10">
                <strong>{event.title}</strong>
                <p className="text-xs text-ink/55 dark:text-white/55">{event.startsAt.toLocaleString()} · {event.type.replace("_", " ")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold">Recent notes</h2>
          {notes.map((note) => <Link href="/notes" key={note.id} className="mb-2 block rounded-xl bg-ink/5 p-3 dark:bg-white/10"><strong>{note.title}</strong><p className="line-clamp-2 text-sm text-ink/55 dark:text-white/55">{note.body}</p></Link>)}
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Recently updated</h2>
          {activity.map((item) => <p key={item.id} className="mb-2 rounded-xl bg-ink/5 p-3 text-sm dark:bg-white/10"><strong>{item.itemName}</strong> {item.action} <span className="text-ink/45 dark:text-white/45">({item.itemType})</span></p>)}
        </div>
      </section>
    </AppShell>
  );
}
