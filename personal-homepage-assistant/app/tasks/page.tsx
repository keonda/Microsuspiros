import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, Select, TextArea, TextInput } from "@/components/crud";
import { completeTask, saveTask } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item, projects] = await Promise.all([
    prisma.task.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { project: true } }),
    edit ? prisma.task.findUnique({ where: { id: edit } }) : null,
    prisma.project.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <AppShell>
      <PageTitle title="Tasks" subtitle="Todo, doing, done, priority, due dates, and quick complete." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveTask} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Title" name="title" defaultValue={item?.title} required />
          <TextArea label="Description" name="description" defaultValue={item?.description} />
          <div className="grid gap-4 sm:grid-cols-2"><Select label="Status" name="status" defaultValue={item?.status ?? "todo"} options={["todo", "doing", "done"]} /><Select label="Priority" name="priority" defaultValue={item?.priority ?? "medium"} options={["low", "medium", "high", "urgent"]} /></div>
          <TextInput label="Due date" name="dueDate" type="datetime-local" defaultValue={item?.dueDate ? item.dueDate.toISOString().slice(0, 16) : ""} />
          <label className="grid gap-1.5"><span className="label">Related project</span><select className="field" name="projectId" defaultValue={item?.projectId ?? ""}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update task" : "Create task"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((task) => <article key={task.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{task.title}</h2><p className="text-sm text-ink/55 dark:text-white/55">{task.status} · {task.priority} · {task.project?.name ?? "No project"}</p></div><div className="flex gap-1"><form action={completeTask}><input type="hidden" name="id" value={task.id} /><button className="btn btn-soft px-3"><CheckCircle2 size={15} /></button></form><DeleteButton type="task" id={task.id} /></div></div><p className="my-3 line-clamp-3 text-sm">{task.description}</p>{task.dueDate && <p className="text-xs text-ink/45 dark:text-white/45">Due {task.dueDate.toLocaleString()}</p>}<a className="btn btn-soft mt-3" href={`/tasks?edit=${task.id}`}>Edit</a></article>)}
        </div>
      </div>
    </AppShell>
  );
}
