import { importPdfResourceAction, uploadPdfForImportAction, uploadResourceAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { pdfPreview } from "@/lib/pdf-import";
import { prisma } from "@/lib/prisma";
import { bytesLabel } from "@/lib/writer-utils";

export default async function ResourcesPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ import?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { import: importId } = await searchParams;
  const resources = await prisma.resource.findMany({ where: { projectId: id, userId: user.id }, orderBy: { createdAt: "desc" } });
  const importResource = importId ? await prisma.resource.findFirst({ where: { id: importId, projectId: id, userId: user.id } }) : null;

  return (
    <div className="p-6">
      <h1 className="font-serif text-3xl font-bold">Resources</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form action={uploadResourceAction.bind(null, id)} className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-xl font-bold">Upload resource</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <input className="rounded-md border border-stone-200 px-3 py-2" name="title" placeholder="Title or label" />
            <input className="rounded-md border border-stone-200 px-3 py-2" name="tagsText" placeholder="tags" />
            <input className="rounded-md border border-stone-200 px-3 py-2 lg:col-span-2" name="file" type="file" required />
          </div>
          <textarea className="mt-3 min-h-20 w-full rounded-md border border-stone-200 px-3 py-2" name="notes" placeholder="Notes" />
          <button className="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment">Upload</button>
        </form>

        <form action={uploadPdfForImportAction.bind(null, id)} className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-xl font-bold">Import PDF</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Upload a PDF, extract selectable text server-side, preview it, then import into a document or note.</p>
          <p className="mt-2 rounded-md bg-parchment px-3 py-2 text-sm text-clay">Scanned PDFs may require OCR, which is not included yet.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <input className="rounded-md border border-stone-200 px-3 py-2" name="title" placeholder="Title or label" />
            <input className="rounded-md border border-stone-200 px-3 py-2" name="tagsText" placeholder="tags" />
            <input accept="application/pdf" className="rounded-md border border-stone-200 px-3 py-2 lg:col-span-2" name="file" type="file" required />
          </div>
          <textarea className="mt-3 min-h-20 w-full rounded-md border border-stone-200 px-3 py-2" name="notes" placeholder="Notes" />
          <button className="mt-3 rounded-md bg-cedar px-4 py-2 text-sm font-semibold text-white">Upload and extract</button>
        </form>
      </div>

      {importResource ? <PdfImportPreview projectId={id} resource={importResource} /> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {resources.map((resource) => (
          <article id={resource.id} key={resource.id} className="rounded-xl bg-paper p-5 ring-1 ring-stone-200">
            <h2 className="font-serif text-xl font-bold">{resource.title}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {resource.originalName} · {bytesLabel(resource.fileSize)} · {resource.mimeType}
            </p>
            {resource.mimeType === "application/pdf" && resource.extractionStatus !== "NONE" ? (
              <p className="mt-2 text-xs text-stone-500">
                Extraction: {resource.extractionStatus.toLowerCase().replace("_", " ")}
                {resource.pageCount ? ` · ${resource.pageCount} pages` : ""}
                {resource.extractedText ? ` · ${resource.extractedText.length.toLocaleString()} characters` : ""}
              </p>
            ) : null}
            <Preview id={resource.id} mimeType={resource.mimeType} title={resource.title} />
            {resource.notes ? <p className="mt-3 text-sm leading-6 text-stone-600">{resource.notes}</p> : null}
            {resource.tagsText ? <p className="mt-2 text-xs text-cedar">{resource.tagsText}</p> : null}
            <a className="mt-4 inline-block rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" href={`/api/resources/${resource.id}/download?download=1`}>
              Download
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function PdfImportPreview({
  projectId,
  resource
}: {
  projectId: string;
  resource: {
    id: string;
    title: string;
    originalName: string;
    fileSize: number;
    extractionStatus: string;
    extractionError: string | null;
    extractedText: string | null;
    pageCount: number | null;
  };
}) {
  const canImport = resource.extractionStatus === "EXTRACTED" && Boolean(resource.extractedText?.trim());
  return (
    <section className="mt-5 rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">PDF import preview</h2>
          <p className="mt-1 text-sm text-stone-500">
            {resource.originalName} · {bytesLabel(resource.fileSize)}
            {resource.pageCount ? ` · ${resource.pageCount} pages` : ""}
          </p>
          <p className="mt-1 text-sm text-stone-500">Extracted characters: {(resource.extractedText?.length || 0).toLocaleString()}</p>
        </div>
        <a className="rounded-md border border-stone-200 px-3 py-2 text-sm" href={`/api/resources/${resource.id}/download?download=1`}>
          Download original PDF
        </a>
      </div>
      <p className="mt-4 rounded-md bg-parchment px-3 py-2 text-sm text-clay">Scanned PDFs may require OCR, which is not included yet.</p>
      {resource.extractionError ? <p className="mt-3 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">{resource.extractionError}</p> : null}
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-parchment p-4 text-sm leading-6">{pdfPreview(resource.extractedText) || "No extracted text available."}</pre>
      <form action={importPdfResourceAction.bind(null, projectId, resource.id)} className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <input className="rounded-md border border-stone-200 px-3 py-2" name="title" defaultValue={resource.title.replace(/\.pdf$/i, "")} required />
        <select className="rounded-md border border-stone-200 px-3 py-2" name="destination" defaultValue="RESEARCH_NOTE" disabled={!canImport}>
          <option value="DOCUMENT">New manuscript document</option>
          <option value="STORY_NOTE">New story note</option>
          <option value="RESEARCH_NOTE">New research note</option>
        </select>
        <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment disabled:opacity-50" disabled={!canImport}>
          Import text
        </button>
      </form>
    </section>
  );
}

function Preview({ id, mimeType, title }: { id: string; mimeType: string; title: string }) {
  const src = `/api/resources/${id}/download`;
  // eslint-disable-next-line @next/next/no-img-element
  if (mimeType.startsWith("image/")) return <img className="mt-4 max-h-72 rounded-lg object-contain" src={src} alt={title} />;
  if (mimeType.startsWith("audio/")) return <audio className="mt-4 w-full" controls src={src} />;
  if (mimeType.startsWith("video/")) return <video className="mt-4 max-h-80 w-full rounded-lg" controls src={src} />;
  if (mimeType === "application/pdf") return <iframe className="mt-4 h-96 w-full rounded-lg border" src={src} title={title} />;
  return null;
}
