import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function getUploadPath(filename: string) {
  if (process.env.UPLOAD_DIR) return path.join(/* turbopackIgnore: true */ process.env.UPLOAD_DIR, filename);
  return path.join(process.cwd(), "uploads", filename);
}

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) {
    return new Response("Invalid filename", { status: 400 });
  }

  try {
    const file = await readFile(getUploadPath(safeFilename));
    const contentType = CONTENT_TYPES[path.extname(safeFilename).toLowerCase()] ?? "application/octet-stream";

    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
