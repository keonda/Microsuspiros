import Link from "next/link";
import { updateProjectAction, uploadPdfForImportAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateLabel, statusLabel } from "@/lib/format";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirstOrThrow({
    where: { id, userId: user.id },
    include: {
      documents: { where: { isTrash: false }, orderBy: { sortOrder: "asc" } },
      _count: { select: { storyNotes: true, researchNotes: true, resources: true } }
    }
  });

  return (
    <div className="p-6">
      <section className="rounded-xl bg-paper p-6 ring-1 ring-stone-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cedar">{statusLabel(project.status)}</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">{project.title}</h1>
            {project.subtitle ? <p className="mt-2 text-lg text-stone-600">{project.subtitle}</p> : null}
            <p className="mt-3 max-w-3xl leading-7 text-stone-600">{project.description || "Use this project space to shape the manuscript, notes, research, brainstorm cards, and resources."}</p>
          </div>
          {project.documents[0] ? (
            <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment" href={`/projects/${project.id}/documents/${project.documents[0].id}`}>
              Open manuscript
            </Link>
          ) : null}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Mini label="Manuscript docs" value={project.documents.length} />
          <Mini label="Story notes" value={project._count.storyNotes} />
          <Mini label="Research notes" value={project._count.researchNotes} />
          <Mini label="Resources" value={project._count.resources} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-2xl font-bold">Manuscript order</h2>
          <div className="mt-4 divide-y divide-stone-100">
            {project.documents.map((doc) => (
              <Link key={doc.id} href={`/projects/${project.id}/documents/${doc.id}`} className="flex items-center justify-between py-3 hover:text-cedar">
                <span>{doc.title}</span>
                <span className="text-sm text-stone-500">{doc.wordCount.toLocaleString()} words</span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <a className="rounded-md border border-stone-200 px-3 py-2 text-sm" href={`/api/exports/projects/${project.id}?format=html`}>Export HTML</a>
            <a className="rounded-md border border-stone-200 px-3 py-2 text-sm" href={`/api/exports/projects/${project.id}?format=txt`}>Export TXT</a>
          </div>
          <form action={uploadPdfForImportAction.bind(null, project.id)} className="mt-5 rounded-lg bg-paper p-4 ring-1 ring-stone-200">
            <h3 className="font-serif text-lg font-bold">Import from PDF</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">Upload a PDF manuscript, review detected chapters, then import selected sections as documents.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input className="rounded-md border border-stone-200 px-3 py-2" name="title" placeholder="Title or label" />
              <input accept="application/pdf" className="rounded-md border border-stone-200 px-3 py-2" name="file" type="file" required />
              <button className="rounded-md bg-cedar px-4 py-2 text-sm font-semibold text-white">Upload</button>
            </div>
          </form>
        </div>
        <form action={updateProjectAction.bind(null, project.id)} className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-2xl font-bold">Project details</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="title" defaultValue={project.title} required />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="subtitle" defaultValue={project.subtitle || ""} placeholder="Subtitle" />
            <input className="w-full rounded-md border border-stone-200 px-3 py-2" name="genre" defaultValue={project.genre || ""} placeholder="Genre" />
            <select className="w-full rounded-md border border-stone-200 px-3 py-2" name="status" defaultValue={project.status}>
              {["IDEA", "DRAFTING", "REVISING", "COMPLETE", "ARCHIVED"].map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
            <textarea className="min-h-32 w-full rounded-md border border-stone-200 px-3 py-2" name="description" defaultValue={project.description || ""} />
          </div>
          <button className="mt-4 rounded-md bg-cedar px-4 py-2 text-sm font-semibold text-white">Save details</button>
          <p className="mt-3 text-xs text-stone-500">Created {dateLabel(project.createdAt)}</p>
        </form>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-stone-200">
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
