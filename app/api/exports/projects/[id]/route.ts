import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { documentToHtml, escapeHtml } from "@/lib/writer-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "html";
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { documents: { where: { kind: "MANUSCRIPT", isTrash: false }, orderBy: { sortOrder: "asc" } } }
  });
  if (!project) return new Response("Not found", { status: 404 });

  const body =
    format === "txt"
      ? [project.title, ...project.documents.map((doc) => `${doc.title}\n\n${doc.plainText}`)].join("\n\n\n")
      : documentToHtml({
          title: project.title,
          contentHtml: project.documents.map((doc) => `<h2>${escapeHtml(doc.title)}</h2>${doc.contentHtml}`).join("\n")
        });

  return new Response(body, {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-manuscript.${format}"`
    }
  });
}
