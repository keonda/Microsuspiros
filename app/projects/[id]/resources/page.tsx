import Link from "next/link";
import { deleteResourceAction, uploadPdfForImportAction, uploadResourceAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bytesLabel } from "@/lib/writer-utils";

export default async function ResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const resources = await prisma.resource.findMany({
    where: { projectId: id, userId: user.id },
    include: { pdfImportSessions: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" }
  });

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
          <p className="mt-2 text-sm leading-6 text-stone-600">Upload a PDF, extract selectable text server-side, detect possible chapters, then review before importing.</p>
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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {resources.map((resource) => (
          <article id={resource.id} key={resource.id} className="rounded-xl bg-paper p-5 ring-1 ring-stone-200">
            <h2 className="font-serif text-xl font-bold">{resource.title}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {resource.originalName} - {bytesLabel(resource.fileSize)} - {resource.mimeType}
            </p>
            {resource.mimeType === "application/pdf" && resource.extractionStatus !== "NONE" ? (
              <p className="mt-2 text-xs text-stone-500">
                Extraction: {resource.extractionStatus.toLowerCase().replace("_", " ")}
                {resource.pageCount ? ` - ${resource.pageCount} pages` : ""}
                {resource.extractedText ? ` - ${resource.extractedText.length.toLocaleString()} characters` : ""}
              </p>
            ) : null}
            <Preview id={resource.id} mimeType={resource.mimeType} title={resource.title} />
            {resource.notes ? <p className="mt-3 text-sm leading-6 text-stone-600">{resource.notes}</p> : null}
            {resource.tagsText ? <p className="mt-2 text-xs text-cedar">{resource.tagsText}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="inline-block rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" href={`/api/resources/${resource.id}/download?download=1`}>
                Download
              </a>
              {resource.pdfImportSessions[0] ? (
                <Link className="inline-block rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" href={`/projects/${id}/pdf-import/${resource.pdfImportSessions[0].id}`}>
                  Continue import
                </Link>
              ) : null}
              <form action={deleteResourceAction.bind(null, id, resource.id)}>
                <button className="rounded-md border border-clay/30 bg-white px-3 py-2 text-sm text-clay" type="submit">
                  Delete
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
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
