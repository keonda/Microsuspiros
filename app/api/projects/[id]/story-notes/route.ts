import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(20000),
  type: z.enum(["CHARACTER", "LOCATION", "SCENE_IDEA", "PLOT_THREAD", "TIMELINE_NOTE", "WORLDBUILDING", "GENERAL"]).default("GENERAL")
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const body = schema.parse(await request.json());
  const note = await prisma.storyNote.create({ data: { title: body.title, body: body.body, type: body.type, projectId: id, userId: user.id } });
  await syncInternalLinks(prisma, { projectId: id, sourceType: "STORY_NOTE", sourceId: note.id, text: `${note.title}\n${note.body}` });
  return Response.json({ ok: true, href: `/projects/${id}/notes#${note.id}` });
}
