import { AssetType, type Asset } from "@prisma/client";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { formatFileSize } from "@/lib/asset-utils";
import { appConfig } from "@/lib/config";

const maxSizes: Record<AssetType, number> = {
  COVER_ART: 8 * 1024 * 1024,
  AUDIO_FULL: 80 * 1024 * 1024,
  AUDIO_SHORT: 40 * 1024 * 1024,
  VIDEO_SHORT: 150 * 1024 * 1024,
  VIDEO_FULL: 250 * 1024 * 1024,
  LYRICS_DOC: 8 * 1024 * 1024,
  OTHER: 25 * 1024 * 1024
};

const mimePrefixes: Partial<Record<AssetType, string[]>> = {
  COVER_ART: ["image/"],
  AUDIO_FULL: ["audio/"],
  AUDIO_SHORT: ["audio/"],
  VIDEO_SHORT: ["video/"],
  VIDEO_FULL: ["video/"],
  LYRICS_DOC: ["text/", "application/pdf", "application/vnd.openxmlformats-officedocument"]
};

function safeSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function folderFor(kind: AssetType) {
  if (kind === AssetType.COVER_ART) return "covers";
  if (kind === AssetType.AUDIO_FULL || kind === AssetType.AUDIO_SHORT) return "audio";
  if (kind === AssetType.VIDEO_SHORT || kind === AssetType.VIDEO_FULL) return "video";
  if (kind === AssetType.LYRICS_DOC) return "docs";
  return "other";
}

export function validateUpload(file: File, kind: AssetType) {
  if (!file.size) return "Choose a file to upload.";
  if (file.size > maxSizes[kind]) return `File is too large. Limit is ${formatFileSize(maxSizes[kind])}.`;
  const allowed = mimePrefixes[kind];
  if (allowed && !allowed.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
    return `Unsupported file type for ${kind.replaceAll("_", " ").toLowerCase()}.`;
  }
  return null;
}

export async function saveUploadedFile(file: File, options: { songId: string; kind: AssetType }) {
  const validation = validateUpload(file, options.kind);
  if (validation) throw new Error(validation);

  const config = appConfig();
  const original = safeSegment(file.name || "upload");
  const ext = path.extname(original);
  const base = safeSegment(path.basename(original, ext)) || "asset";
  const fileName = `${Date.now()}-${base}${ext}`;
  const relativeDir = path.join(folderFor(options.kind), options.songId);
  const absoluteDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.uploadDir, relativeDir);
  const absolutePath = path.join(absoluteDir, fileName);
  const uploadRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.uploadDir);

  if (!absolutePath.startsWith(uploadRoot)) {
    throw new Error("Unsafe upload path.");
  }

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const relativePath = path.posix.join("uploads", folderFor(options.kind), options.songId, fileName);
  return {
    fileName,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    path: relativePath,
    url: `/${relativePath}`
  };
}

export async function deleteStoredFile(asset: Pick<Asset, "storageType" | "path">) {
  if (asset.storageType !== "LOCAL" || !asset.path) return;
  const config = appConfig();
  const uploadRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), config.uploadDir);
  const relative = asset.path.replace(/^\/?uploads[\\/]/, "");
  const absolutePath = path.resolve(uploadRoot, relative);
  if (!absolutePath.startsWith(uploadRoot)) return;
  await unlink(absolutePath).catch(() => undefined);
}
