import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentTypeForFile, getUploadPath } from "@/lib/uploads";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) {
    return new Response("Invalid filename", { status: 400 });
  }

  try {
    const file = await readFile(getUploadPath(safeFilename));

    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentTypeForFile(safeFilename),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
