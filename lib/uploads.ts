import { stat } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export function getUploadPath(filename: string) {
  if (process.env.UPLOAD_DIR) return path.join(/* turbopackIgnore: true */ process.env.UPLOAD_DIR, filename);
  return path.join(process.cwd(), "uploads", filename);
}

export function filenameFromUploadUrl(imageUrl: string) {
  if (!imageUrl.startsWith("/api/uploads/")) return null;
  const filename = decodeURIComponent(imageUrl.replace("/api/uploads/", ""));
  const safeFilename = path.basename(filename);
  return safeFilename === filename ? filename : null;
}

export function contentTypeForFile(filename: string) {
  return UPLOAD_CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

export async function assertSmallEnoughForVision(filePath: string) {
  const file = await stat(filePath);
  if (file.size > 3_800_000) {
    throw new Error("Photo is too large for Groq vision OCR. Try a closer crop or smaller image.");
  }
}
