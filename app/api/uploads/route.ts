import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

async function ensureUploadDir(uploadDir: string) {
  try {
    const existing = await stat(uploadDir);
    if (!existing.isDirectory()) {
      throw new Error(`${uploadDir} exists but is not a directory. In Coolify, remove that storage entry and add a directory/volume mount instead.`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await mkdir(uploadDir, { recursive: true });
      return;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Upload an image file." }, { status: 400 });
  }

  const extension = IMAGE_EXTENSIONS.get(file.type);
  if (!extension) {
    return Response.json({ error: "Only JPG, PNG, WEBP, and GIF images are supported." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Image must be smaller than 8 MB." }, { status: 413 });
  }

  try {
    const uploadDir = getUploadDir();
    await ensureUploadDir(uploadDir);

    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), bytes);

    return Response.json({ ok: true, url: `/api/uploads/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save upload.";
    return Response.json({ error: message }, { status: 500 });
  }
}
