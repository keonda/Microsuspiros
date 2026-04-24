import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/", "text/"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf"
];

export function uploadsRoot() {
  const configured = process.env.UPLOAD_DIR || "public/uploads";
  return path.isAbsolute(configured) ? configured : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
}

export function uploadRootCandidates() {
  const roots = [
    uploadsRoot(),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public/uploads"),
    path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads"),
    "/app/public/uploads",
    "/app/uploads"
  ];
  return Array.from(new Set(roots.map((root) => path.resolve(root))));
}

export async function resolveStoredUpload(relativePath: string) {
  for (const root of uploadRootCandidates()) {
    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(root)) continue;
    const fileStat = await stat(absolutePath).catch(() => null);
    if (fileStat?.isFile()) return { absolutePath, fileStat };
  }
  return null;
}

export function validateUpload(file: File) {
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_UPLOAD_SIZE) return "Files must be 50 MB or smaller.";
  const ok = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)) || ALLOWED_MIME_TYPES.includes(file.type);
  if (!ok) return "That file type is not allowed.";
  return null;
}

export async function storeUpload(projectId: string, file: File) {
  const safeExt = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  const fileName = `${Date.now()}-${randomBytes(10).toString("hex")}${safeExt}`;
  const relativePath = path.join(projectId, fileName);
  const absoluteDir = path.join(uploadsRoot(), projectId);
  const absolutePath = path.join(uploadsRoot(), relativePath);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return { fileName, relativePath, absolutePath };
}
