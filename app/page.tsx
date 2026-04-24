import Link from "next/link";
import { FileText, FolderOpen, Library, PenLine, Upload } from "lucide-react";
import { createProjectAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateLabel } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const [projects, projectCount, documentCount, words, recentUploads] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.project.count({ where: { userId: user.id } }),
    prisma.document.count({ where: { userId: user.id, isTrash: false } }),
    prisma.document.aggregate({ where: { userId: user.id, isTrash: false }, _sum: { wordCount: true } }),
    prisma.resource.count({ where: { userId: user.id } })
  ]);

  const continueProject = projects[0];
  const continueDocument = continueProject
    ? await prisma.document.findFirst({ where: { projectId: continueProject.id, userId: user.id, isTrash: false }, orderBy: { updatedAt: "desc" } })
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-7 text-[var(--card-foreground)] shadow-soft">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--primary)]">Dashboard</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[var(--foreground)]">A quiet place to pick up the thread.</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted-foreground)]">
            Recent manuscripts, notes, research, brainstorm boards, and resources stay connected by project.
          </p>
          {continueProject ? (
            <Link
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm"
              href={continueDocument ? `/projects/${continueProject.id}/documents/${continueDocument.id}` : `/projects/${continueProject.id}`}
            >
              <PenLine className="size-4" /> Continue writing
            </Link>
          ) : null}
        </div>
        <form action={createProjectAction} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--card-foreground)] shadow-sm">
          <h2 className="font-serif text-xl font-bold">New project</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" name="title" placeholder="Title" required />
            <input className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" name="subtitle" placeholder="Subtitle" />
            <input className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" name="genre" placeholder="Genre" />
            <textarea className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" name="description" placeholder="Description" />
          </div>
          <button className="mt-4 w-full rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]">Create project</button>
        </form>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<FolderOpen />} label="Projects" value={projectCount} />
        <Stat icon={<FileText />} label="Documents" value={documentCount} />
        <Stat icon={<Library />} label="Total words" value={words._sum.wordCount ?? 0} />
        <Stat icon={<Upload />} label="Uploads" value={recentUploads} />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold text-[var(--foreground)]">Recent projects</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--card-foreground)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft" href={`/projects/${project.id}`}>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">{project.status.toLowerCase()}</span>
              <h3 className="mt-2 font-serif text-2xl font-bold text-[var(--foreground)]">{project.title}</h3>
              <p className="mt-2 line-clamp-3 min-h-16 text-sm leading-6 text-[var(--muted-foreground)]">{project.description || project.subtitle || "No description yet."}</p>
              <p className="mt-4 text-xs text-[var(--muted-foreground)]">Updated {dateLabel(project.updatedAt)}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--card-foreground)] shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)] [&_svg]:size-5">{icon}</div>
      <div className="text-3xl font-bold text-[var(--foreground)]">{value.toLocaleString()}</div>
      <div className="text-sm text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
