import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { documentToHtml, escapeHtml } from "@/lib/writer-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "html";
  const includeTitlePage = url.searchParams.get("titlePage") !== "0";
  const includeChapterTitles = url.searchParams.get("chapterTitles") !== "0";
  const includeSceneSeparators = url.searchParams.get("sceneSeparators") === "1";
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: { documents: { where: { kind: "MANUSCRIPT", isTrash: false }, orderBy: { sortOrder: "asc" }, include: { scenes: { orderBy: { sortOrder: "asc" } } } } }
  });
  if (!project) return new Response("Not found", { status: 404 });

  const body =
    format === "txt"
      ? [
          includeTitlePage ? project.title : null,
          ...project.documents.map((doc) =>
            [includeChapterTitles ? doc.title : null, doc.plainText, includeSceneSeparators && doc.scenes.length ? `\nScene outline:\n${doc.scenes.map((scene) => `--- scene: ${scene.title} ---\n${scene.summary}`).join("\n\n")}` : null]
              .filter(Boolean)
              .join("\n\n")
          )
        ]
          .filter(Boolean)
          .join("\n\n\n")
      : documentToHtml({
          title: project.title,
          contentHtml: [
            includeTitlePage ? `<h1>${escapeHtml(project.title)}</h1>` : null,
            ...project.documents.map((doc) =>
              `${includeChapterTitles ? `<h2>${escapeHtml(doc.title)}</h2>` : ""}${doc.contentHtml}${
                includeSceneSeparators && doc.scenes.length
                  ? `<section><h3>Scene outline</h3>${doc.scenes.map((scene) => `<hr /><p><strong>scene: ${escapeHtml(scene.title)}</strong></p><p>${escapeHtml(scene.summary)}</p>`).join("")}</section>`
                  : ""
              }`
            )
          ]
            .filter(Boolean)
            .join("\n")
        });

  return new Response(body, {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-manuscript.${format}"`
    }
  });
}
