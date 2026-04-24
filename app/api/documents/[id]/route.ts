import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { wordCount } from "@/lib/writer-utils";

const saveSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  contentJson: z.unknown().optional(),
  contentHtml: z.string().max(2_000_000),
  plainText: z.string().max(1_000_000)
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = saveSchema.parse(await request.json());
  const words = wordCount(body.plainText);

  const result = await prisma.document.updateMany({
    where: { id, userId: user.id },
    data: {
      title: body.title,
      contentJson: body.contentJson as never,
      contentHtml: body.contentHtml,
      plainText: body.plainText,
      wordCount: words,
      charCount: body.plainText.length
    }
  });

  if (!result.count) return Response.json({ error: "Document not found." }, { status: 404 });
  return Response.json({ ok: true, savedAt: new Date().toISOString(), wordCount: words, charCount: body.plainText.length });
}
