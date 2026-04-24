import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDocumentVersion } from "@/lib/document-versions";
import { prisma } from "@/lib/prisma";

const snapshotSchema = z.object({ changeSummary: z.string().trim().max(300).optional() });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return Response.json({ versions });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = snapshotSchema.parse(await request.json().catch(() => ({})));
  const document = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
  const version = await createDocumentVersion(prisma, document, body.changeSummary || "Manual snapshot");
  return Response.json({ ok: true, version });
}
