import Link from "next/link";
import { importPdfSectionsAction, rerunPdfDetectionAction } from "@/actions/writer-actions";
import { requireUser } from "@/lib/auth";
import { pdfPreview, type DetectedPdfSection } from "@/lib/pdf-import";
import { prisma } from "@/lib/prisma";
import { bytesLabel, wordCount } from "@/lib/writer-utils";
import { Prisma } from "@prisma/client";

const scannedMessage = "This PDF appears to be scanned or image-based. OCR is not supported yet.";

export default async function PdfImportSessionPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const user = await requireUser();
  const { id, sessionId } = await params;
  const session = await prisma.pdfImportSession.findFirstOrThrow({
    where: { id: sessionId, projectId: id, userId: user.id },
    include: { resource: true, importedItems: { orderBy: { sortOrder: "asc" } } }
  });
  const payload = pdfSessionPayload(session.detectedSectionsJson);
  const sections = payload.sections;
  const canImport = session.resource.extractionStatus === "EXTRACTED" && Boolean(session.extractedText?.trim());
  const lowConfidence = payload.warnings.some((warning) => /uncertain|short|many|no chapters/i.test(warning)) || sections.some((section) => section.confidence < 0.6);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">PDF import</p>
          <h1 className="font-serif text-3xl font-bold">{session.resource.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" href={`/projects/${id}/resources`}>
            Resources
          </Link>
          <a className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm" href={`/api/resources/${session.resource.id}/download?download=1`}>
            Download original PDF
          </a>
        </div>
      </div>

      <section className="rounded-xl bg-paper p-5 ring-1 ring-stone-200">
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Detected sections" value={sections.length.toLocaleString()} />
          <Stat label="Extracted characters" value={(session.extractedText?.length || 0).toLocaleString()} />
          <Stat label="Pages" value={session.resource.pageCount?.toLocaleString() || "Unknown"} />
          <Stat label="File size" value={bytesLabel(session.resource.fileSize)} />
        </div>
        <p className="mt-4 text-sm text-stone-500">
          {session.resource.originalName} - {session.resource.mimeType} - extraction {session.resource.extractionStatus.toLowerCase().replace("_", " ")}
        </p>
        <p className="mt-3 rounded-md bg-parchment px-3 py-2 text-sm text-clay">Scanned PDFs may require OCR, which is not included yet.</p>
        {!canImport ? <p className="mt-3 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">{session.resource.extractionError || scannedMessage}</p> : null}
        {lowConfidence ? <p className="mt-3 rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">Chapter detection uncertain; review before importing.</p> : null}
        {payload.warnings.map((warning) => (
          <p key={warning} className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-stone-600 ring-1 ring-stone-200">
            {warning}
          </p>
        ))}
      </section>

      <section className="mt-5 rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="font-serif text-2xl font-bold">Manual split marker</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">Enter repeated text that starts each section, such as Chapter or Scene, then re-run detection before importing.</p>
        <form action={rerunPdfDetectionAction.bind(null, id, session.id)} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input className="min-w-0 flex-1 rounded-md border border-stone-200 px-3 py-2" name="manualMarker" defaultValue={payload.manualMarker || ""} placeholder="Chapter" disabled={!canImport} />
          <button className="rounded-md bg-cedar px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!canImport}>
            Re-run detection
          </button>
        </form>
      </section>

      <form action={importPdfSectionsAction.bind(null, id, session.id)} className="mt-5 rounded-xl bg-white p-5 ring-1 ring-stone-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold">Import preview</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">Review, rename, exclude, or merge sections. Nothing is created until you import.</p>
          </div>
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-parchment disabled:opacity-50" disabled={!canImport}>
            Import selected sections
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="text-sm font-semibold">
            Import mode
            <select className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 font-normal" name="importMode" defaultValue={sections.length > 1 ? "sections" : "single"} disabled={!canImport}>
              <option value="sections">Import as detected chapters</option>
              <option value="single">Import as one document</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Destination
            <select className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 font-normal" name="destination" defaultValue="DOCUMENT" disabled={!canImport}>
              <option value="DOCUMENT">Manuscript documents</option>
              <option value="STORY_NOTE">Story notes</option>
              <option value="RESEARCH_NOTE">Research notes</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Single import title
            <input className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 font-normal" name="singleTitle" defaultValue={session.resource.title.replace(/\.pdf$/i, "")} disabled={!canImport} />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {sections.length ? (
            sections.map((section, index) => <SectionRow key={section.id} section={section} first={index === 0} />)
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-parchment p-4 text-sm leading-6">{pdfPreview(session.extractedText) || "No extracted text available."}</pre>
          )}
        </div>
      </form>

      {session.importedItems.length ? (
        <section className="mt-5 rounded-xl bg-paper p-5 ring-1 ring-stone-200">
          <h2 className="font-serif text-2xl font-bold">Imported items</h2>
          <div className="mt-3 space-y-2">
            {session.importedItems.map((item) => (
              <p key={item.id} className="text-sm text-stone-600">
                {item.title} - {item.targetType.toLowerCase().replace("_", " ")}
              </p>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SectionRow({ section, first }: { section: DetectedPdfSection; first: boolean }) {
  const words = wordCount(section.text);
  const excerpt = section.text.replace(/\s+/g, " ").slice(0, 360);
  return (
    <article className="rounded-lg border border-stone-200 bg-paper p-4">
      <input type="hidden" name="sectionId" value={section.id} />
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto]">
        <label className="flex items-center gap-2 text-sm">
          <input name={`include-${section.id}`} type="checkbox" defaultChecked={section.include} />
          Include
        </label>
        <input className="min-w-0 rounded-md border border-stone-200 px-3 py-2 font-serif text-lg font-bold" name={`title-${section.id}`} defaultValue={section.title} />
        <div className="text-sm text-stone-500">
          {words.toLocaleString()} words - {Math.round(section.confidence * 100)}%
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
        <span>Pattern: {section.detectedPattern}</span>
        {first ? null : (
          <label className="flex items-center gap-2">
            <input name={`merge-${section.id}`} type="checkbox" />
            Merge with previous
          </label>
        )}
      </div>
      {section.warnings?.map((warning) => (
        <p key={warning} className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-clay">
          {warning}
        </p>
      ))}
      <p className="mt-3 text-sm leading-6 text-stone-600">{excerpt || "No preview text available."}</p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-stone-200">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function pdfSessionPayload(value: Prisma.JsonValue): { sections: DetectedPdfSection[]; warnings: string[]; manualMarker?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { sections: [], warnings: [] };
  const record = value as { sections?: DetectedPdfSection[]; warnings?: string[]; manualMarker?: string };
  return {
    sections: Array.isArray(record.sections) ? record.sections : [],
    warnings: Array.isArray(record.warnings) ? record.warnings : [],
    manualMarker: typeof record.manualMarker === "string" ? record.manualMarker : undefined
  };
}
