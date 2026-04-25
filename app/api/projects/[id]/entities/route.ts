import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectEntityCandidates, normalizeEntityType, syncEntityMentions } from "@/lib/story-entities";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().optional(),
  description: z.string().trim().max(4000).optional(),
  aliasesText: z.string().trim().max(800).optional(),
  linkedNoteId: z.string().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const entities = await prisma.storyEntity.findMany({
    where: { projectId: id, userId: user.id },
    include: { _count: { select: { mentions: true } }, mentions: { orderBy: { createdAt: "desc" }, take: 8 } },
    orderBy: [{ type: "asc" }, { name: "asc" }]
  });
  return Response.json({ entities });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const body = createSchema.parse(await request.json());
  const aliases = (body.aliasesText || "")
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean)
    .slice(0, 20);
  const entity = await prisma.storyEntity.upsert({
    where: { projectId_name: { projectId: id, name: body.name } },
    create: {
      projectId: id,
      userId: user.id,
      name: body.name,
      type: normalizeEntityType(body.type),
      description: body.description || "",
      aliases,
      linkedNoteId: body.linkedNoteId || null
    },
    update: {
      type: normalizeEntityType(body.type),
      description: body.description || "",
      aliases,
      linkedNoteId: body.linkedNoteId || null
    }
  });
  await resyncProjectMentions(id, user.id);
  return Response.json({ ok: true, entity });
}

export async function PUT(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const documents = await prisma.document.findMany({ where: { projectId: id, userId: user.id, isTrash: false }, select: { plainText: true } });
  const existing = await prisma.storyEntity.findMany({ where: { projectId: id, userId: user.id }, select: { name: true } });
  const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));
  const candidates = detectEntityCandidates(documents.map((doc) => doc.plainText).join("\n\n")).filter((candidate) => !existingNames.has(candidate.name.toLowerCase()));
  return Response.json({ candidates });
}

async function resyncProjectMentions(projectId: string, userId: string) {
  const documents = await prisma.document.findMany({ where: { projectId, userId, isTrash: false }, select: { id: true, title: true, plainText: true } });
  for (const document of documents) {
    await syncEntityMentions(prisma, {
      projectId,
      userId,
      sourceType: "DOCUMENT",
      sourceId: document.id,
      text: `${document.title}\n${document.plainText}`
    });
  }
}
