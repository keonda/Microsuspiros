import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sceneSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  summary: z.string().trim().max(4000).optional(),
  povCharacter: z.string().trim().max(120).optional(),
  location: z.string().trim().max(180).optional(),
  goal: z.string().trim().max(1000).optional(),
  conflict: z.string().trim().max(1000).optional(),
  outcome: z.string().trim().max(1000).optional(),
  emotionalTone: z.string().trim().max(120).optional(),
  sortOrder: z.number().int().min(0).optional(),
  startMarker: z.string().trim().max(180).optional(),
  endMarker: z.string().trim().max(180).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ sceneId: string }> }) {
  const user = await requireUser();
  const { sceneId } = await params;
  const body = sceneSchema.parse(await request.json());
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, userId: user.id } });
  if (!scene) return Response.json({ error: "Scene not found." }, { status: 404 });
  const updated = await prisma.scene.update({ where: { id: scene.id }, data: body });
  return Response.json({ ok: true, scene: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ sceneId: string }> }) {
  const user = await requireUser();
  const { sceneId } = await params;
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, userId: user.id } });
  if (!scene) return Response.json({ error: "Scene not found." }, { status: 404 });
  await prisma.scene.delete({ where: { id: scene.id } });
  return Response.json({ ok: true });
}
