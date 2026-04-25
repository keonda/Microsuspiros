import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEntityType } from "@/lib/story-entities";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  type: z.string().optional(),
  description: z.string().trim().max(4000).optional(),
  aliasesText: z.string().trim().max(800).optional(),
  linkedNoteId: z.string().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ entityId: string }> }) {
  const user = await requireUser();
  const { entityId } = await params;
  const body = updateSchema.parse(await request.json());
  const entity = await prisma.storyEntity.findFirst({ where: { id: entityId, userId: user.id } });
  if (!entity) return Response.json({ error: "Entity not found." }, { status: 404 });
  const aliases = body.aliasesText
    ?.split(",")
    .map((alias) => alias.trim())
    .filter(Boolean)
    .slice(0, 20);
  const updated = await prisma.storyEntity.update({
    where: { id: entity.id },
    data: {
      name: body.name,
      type: body.type ? normalizeEntityType(body.type) : undefined,
      description: body.description,
      aliases,
      linkedNoteId: body.linkedNoteId || null
    }
  });
  return Response.json({ ok: true, entity: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ entityId: string }> }) {
  const user = await requireUser();
  const { entityId } = await params;
  const entity = await prisma.storyEntity.findFirst({ where: { id: entityId, userId: user.id } });
  if (!entity) return Response.json({ error: "Entity not found." }, { status: 404 });
  await prisma.storyEntity.delete({ where: { id: entity.id } });
  return Response.json({ ok: true });
}
