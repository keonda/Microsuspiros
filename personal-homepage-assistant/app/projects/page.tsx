import { AppShell } from "@/components/app-shell";
import { Checkbox, DeleteButton, PageTitle, Select, TextArea, TextInput } from "@/components/crud";
import { saveProject } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireUser();
  const { edit } = await searchParams;
  const [items, item] = await Promise.all([
    prisma.project.findMany({ orderBy: { updatedAt: "desc" } }),
    edit ? prisma.project.findUnique({ where: { id: edit } }) : null
  ]);
  return (
    <AppShell>
      <PageTitle title="Projects" subtitle="Track priorities, status, related links, tags, and next notes." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form action={saveProject} className="card space-y-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <TextInput label="Project name" name="name" defaultValue={item?.name} required />
          <TextArea label="Description" name="description" defaultValue={item?.description} />
          <div className="grid gap-4 sm:grid-cols-2"><Select label="Status" name="status" defaultValue={item?.status ?? "active"} options={["active", "idea", "paused", "archived", "complete"]} /><Select label="Priority" name="priority" defaultValue={item?.priority ?? "medium"} options={["low", "medium", "high", "urgent"]} /></div>
          <TextArea label="Related links" name="relatedLinks" defaultValue={item?.relatedLinks} />
          <TextArea label="Notes" name="notes" defaultValue={item?.notes} />
          <Checkbox label="Pin to dashboard" name="pinned" defaultChecked={item?.pinned} />
          <button className="btn btn-primary w-full">{item ? "Update project" : "Create project"}</button>
        </form>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((project) => <article key={project.id} className="card"><div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{project.name}</h2><p className="text-sm text-ink/55 dark:text-white/55">{project.status} · {project.priority}</p></div><DeleteButton type="project" id={project.id} /></div><p className="my-3 line-clamp-3 text-sm">{project.description || project.notes}</p><p className="text-xs text-ink/45 dark:text-white/45">Updated {project.updatedAt.toLocaleString()}</p><a className="btn btn-soft mt-3" href={`/projects?edit=${project.id}`}>Edit</a></article>)}
        </div>
      </div>
    </AppShell>
  );
}
