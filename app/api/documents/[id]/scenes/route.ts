import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sceneSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(4000).optional(),
  povCharacter: z.string().trim().max(120).optional(),
  location: z.string().trim().max(180).optional(),
  goal: z.string().trim().max(1000).optional(),
  conflict: z.string().trim().max(1000).optional(),
  outcome: z.string().trim().max(1000).optional(),
  emotionalTone: z.string().trim().max(120).optional(),
  startMarker: z.string().trim().max(180).optional(),
  endMarker: z.string().trim().max(180).optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const scenes = await prisma.scene.findMany({ where: { documentId: id, userId: user.id }, orderBy: { sortOrder: "asc" } });
  return Response.json({ scenes });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = sceneSchema.parse(await request.json());
  const document = await prisma.document.findFirst({ where: { id, userId: user.id }, select: { id: true, projectId: true } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const maxOrder = await prisma.scene.aggregate({ where: { documentId: id, userId: user.id }, _max: { sortOrder: true } });
  const scene = await prisma.scene.create({
    data: {
      ...body,
      summary: body.summary || "",
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      documentId: document.id,
      projectId: document.projectId,
      userId: user.id
    }
  });
  return Response.json({ ok: true, scene });
}
