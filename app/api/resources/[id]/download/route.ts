import { createReadStream } from "node:fs";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveStoredUpload } from "@/lib/uploads";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const resource = await prisma.resource.findFirst({ where: { id, userId: user.id } });
  if (!resource) return new Response("Not found", { status: 404 });

  const stored = await resolveStoredUpload(resource.path);
  if (!stored) return new Response("File missing", { status: 404 });

  const stream = createReadStream(stored.absolutePath);
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new Response(stream as never, {
    headers: {
      "Content-Type": resource.mimeType,
      "Content-Length": String(stored.fileStat.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(resource.originalName)}"`
    }
  });
}
