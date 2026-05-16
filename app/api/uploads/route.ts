import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
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

  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), bytes);

  return Response.json({ ok: true, url: `/api/uploads/${filename}` });
}
