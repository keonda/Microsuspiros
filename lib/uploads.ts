import path from "path";

export const maxUploadBytes = 25 * 1024 * 1024;

export const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/zip"
]);

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./public/uploads");
}

export function publicUploadUrl(filename: string) {
  return `/uploads/${filename}`;
}
