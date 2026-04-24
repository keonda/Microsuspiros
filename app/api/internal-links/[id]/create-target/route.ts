import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

const schema = z.object({ targetType: z.enum(["DOCUMENT", "STORY_NOTE", "RESEARCH_NOTE"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = schema.parse(await request.json());
  const link = await prisma.internalLink.findFirst({ where: { id } });
  if (!link) return Response.json({ error: "Link not found." }, { status: 404 });
  const project = await prisma.project.findFirst({ where: { id: link.projectId, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const title = link.rawText.replace(/^(Character|Location|Research|Note|Chapter|Resource|Card)\s*:\s*/i, "").trim();

  const target =
    body.targetType === "DOCUMENT"
      ? await prisma.document.create({ data: { title, projectId: project.id, userId: user.id, contentHtml: "<p></p>" } })
      : body.targetType === "STORY_NOTE"
        ? await prisma.storyNote.create({ data: { title, projectId: project.id, userId: user.id, type: "GENERAL" } })
        : await prisma.researchNote.create({ data: { title, projectId: project.id, userId: user.id } });

  await prisma.internalLink.update({ where: { id: link.id }, data: { targetType: body.targetType, targetId: target.id } });
  if (link.sourceType === "DOCUMENT") {
    const source = await prisma.document.findFirst({ where: { id: link.sourceId, userId: user.id } });
    if (source) await syncInternalLinks(prisma, { projectId: source.projectId, sourceType: "DOCUMENT", sourceId: source.id, text: `${source.title}\n${source.plainText}` });
  }

  return Response.json({ ok: true, href: hrefFor(project.id, body.targetType, target.id) });
}

function hrefFor(projectId: string, type: string, id: string) {
  if (type === "DOCUMENT") return `/projects/${projectId}/documents/${id}`;
  if (type === "STORY_NOTE") return `/projects/${projectId}/notes#${id}`;
  return `/projects/${projectId}/research#${id}`;
}
