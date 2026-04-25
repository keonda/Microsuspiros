import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(20000)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const body = schema.parse(await request.json());
  const note = await prisma.researchNote.create({
    data: { title: body.title, summary: body.summary, personalNotes: "", projectId: id, userId: user.id }
  });
  await syncInternalLinks(prisma, { projectId: id, sourceType: "RESEARCH_NOTE", sourceId: note.id, text: `${note.title}\n${note.summary}` });
  return Response.json({ ok: true, href: `/projects/${id}/research#${note.id}` });
}
