import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { documentToHtml } from "@/lib/writer-utils";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "html";
  const document = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!document) return new Response("Not found", { status: 404 });

  const body = format === "txt" ? `${document.title}\n\n${document.plainText}` : documentToHtml(document);
  return new Response(body, {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${format}"`
    }
  });
}
