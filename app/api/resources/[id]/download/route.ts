import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadsRoot } from "@/lib/uploads";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const resource = await prisma.resource.findFirst({ where: { id, userId: user.id } });
  if (!resource) return new Response("Not found", { status: 404 });

  const absolutePath = path.resolve(uploadsRoot(), resource.path);
  if (!absolutePath.startsWith(path.resolve(uploadsRoot()))) return new Response("Invalid path", { status: 400 });

  const fileStat = await stat(absolutePath).catch(() => null);
  if (!fileStat) return new Response("File missing", { status: 404 });

  const stream = createReadStream(absolutePath);
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new Response(stream as never, {
    headers: {
      "Content-Type": resource.mimeType,
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(resource.originalName)}"`
    }
  });
}
