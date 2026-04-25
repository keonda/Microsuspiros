import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createDocumentVersion, shouldCreateTimedVersion } from "@/lib/document-versions";
import { syncInternalLinks } from "@/lib/internal-links";
import { prisma } from "@/lib/prisma";
import { syncEntityMentions } from "@/lib/story-entities";
import { wordCount } from "@/lib/writer-utils";

const saveSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(2_000_000),
  plainText: z.string().max(1_000_000),
  saveMode: z.enum(["autosave", "manual", "snapshot"]).default("autosave")
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = saveSchema.parse(await request.json());
  const words = wordCount(body.plainText);
  const existing = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Document not found." }, { status: 404 });

  const document = await prisma.document.update({
    where: { id },
    data: {
      title: body.title,
      contentJson: body.contentJson as never,
      contentHtml: body.contentHtml,
      plainText: body.plainText,
      wordCount: words,
      charCount: body.plainText.length
    }
  });

  const shouldVersion =
    body.saveMode === "manual" || body.saveMode === "snapshot" || (body.saveMode === "autosave" && (await shouldCreateTimedVersion(prisma, document.id)));

  if (shouldVersion) {
    await createDocumentVersion(prisma, document, body.saveMode === "snapshot" ? "Manual snapshot" : body.saveMode === "manual" ? "Manual save" : "Timed autosave snapshot");
  }

  await syncInternalLinks(prisma, {
    projectId: document.projectId,
    sourceType: "DOCUMENT",
    sourceId: document.id,
    text: `${document.title}\n${document.plainText}`
  });
  await syncEntityMentions(prisma, {
    projectId: document.projectId,
    userId: user.id,
    sourceType: "DOCUMENT",
    sourceId: document.id,
    text: `${document.title}\n${document.plainText}`
  });

  return Response.json({
    ok: true,
    savedAt: document.updatedAt.toISOString(),
    wordCount: words,
    charCount: body.plainText.length,
    versionCreated: shouldVersion
  });
}
