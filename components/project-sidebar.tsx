import Link from "next/link";
import { ArchiveRestore, Bot, FilePlus, FileText, FlaskConical, GitFork, Lightbulb, NotebookTabs, Search, Trash2, Upload } from "lucide-react";
import type { Document, Project } from "@prisma/client";
import { createDocumentAction, restoreDocumentAction } from "@/actions/writer-actions";
import { cn } from "@/lib/format";

export function ProjectSidebar({
  project,
  documents,
  trash,
  activeDocumentId
}: {
  project: Project;
  documents: Document[];
  trash: Document[];
  activeDocumentId?: string;
}) {
  return (
    <aside className="project-sidebar h-full border-r border-[var(--border)] bg-[var(--sidebar-background)] p-4 text-[var(--foreground)]">
      <Link href={`/projects/${project.id}`} className="block rounded-lg px-2 py-2 transition hover:bg-[var(--muted)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Project</p>
        <h2 className="mt-1 font-serif text-xl font-bold leading-tight text-[var(--foreground)]">{project.title}</h2>
      </Link>
      <nav className="mt-5 space-y-1 text-sm">
        <Nav href={`/projects/${project.id}/notes`} icon={<NotebookTabs />} label="Story Notes" />
        <Nav href={`/projects/${project.id}/research`} icon={<FlaskConical />} label="Research" />
        <Nav href={`/projects/${project.id}/brainstorm`} icon={<Lightbulb />} label="Brainstorm" />
        <Nav href={`/projects/${project.id}/resources`} icon={<Upload />} label="Resources" />
        <Nav href={`/projects/${project.id}/graph`} icon={<GitFork />} label="Graph" />
        <Nav href={`/projects/${project.id}/assistant`} icon={<Bot />} label="AI Assistant" />
        <Nav href={`/projects/${project.id}/search`} icon={<Search />} label="Search Project" />
      </nav>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Manuscript</h3>
        </div>
        <form action={createDocumentAction.bind(null, project.id)} className="mb-3 flex gap-2">
          <input className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]" name="title" placeholder="New document" required />
          <button className="rounded-md bg-[var(--primary)] px-2 text-[var(--primary-foreground)]" title="Create document">
            <FilePlus className="size-4" />
          </button>
        </form>
        <div className="space-y-1">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/projects/${project.id}/documents/${doc.id}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--border)] hover:bg-[var(--muted)]",
                activeDocumentId === doc.id && "border-[var(--primary)] bg-[var(--card)] text-[var(--primary)] shadow-sm"
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </span>
              <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">{doc.wordCount}</span>
            </Link>
          ))}
        </div>
      </div>
      <details className="mt-6">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <Trash2 className="size-4" /> Trash
        </summary>
        <div className="mt-2 space-y-2">
          {trash.map((doc) => (
            <form key={doc.id} action={restoreDocumentAction.bind(null, project.id, doc.id)} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 text-sm">
              <span className="truncate">{doc.title}</span>
              <button title="Restore" className="text-moss">
                <ArchiveRestore className="size-4" />
              </button>
            </form>
          ))}
          {!trash.length ? <p className="text-sm text-[var(--muted-foreground)]">Empty.</p> : null}
        </div>
      </details>
    </aside>
  );
}

function Nav({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link className="flex items-center gap-2 rounded-md px-2 py-2 text-[var(--foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--primary)] [&_svg]:size-4" href={href}>
      {icon}
      {label}
    </Link>
  );
}
