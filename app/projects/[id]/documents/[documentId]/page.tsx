import { notFound } from "next/navigation";
import { renameDocumentAction, trashDocumentAction } from "@/actions/writer-actions";
import { WriterEditor } from "@/components/editor";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DocumentPage({ params }: { params: Promise<{ id: string; documentId: string }> }) {
  const user = await requireUser();
  const { id, documentId } = await params;
  const document = await prisma.document.findFirst({ where: { id: documentId, projectId: id, userId: user.id } });
  if (!document) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 text-[var(--foreground)]">
        <form action={renameDocumentAction.bind(null, id, document.id)} className="flex gap-2">
          <input className="rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm" name="title" defaultValue={document.title} />
          <button className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">Rename</button>
        </form>
        <div className="flex gap-2">
          <a className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" href={`/api/exports/documents/${document.id}?format=html`}>HTML</a>
          <a className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" href={`/api/exports/documents/${document.id}?format=txt`}>TXT</a>
          <form action={trashDocumentAction.bind(null, id, document.id)}>
            <button className="rounded-md border border-clay/30 px-3 py-2 text-sm text-clay">Move to trash</button>
          </form>
        </div>
      </div>
      <WriterEditor
        projectId={id}
        documentId={document.id}
        title={document.title}
        contentJson={document.contentJson}
        contentHtml={document.contentHtml}
        wordCount={document.wordCount}
        charCount={document.charCount}
        updatedAt={document.updatedAt.toISOString()}
      />
    </div>
  );
}
