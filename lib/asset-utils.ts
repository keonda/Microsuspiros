import type { Asset } from "@prisma/client";

export function formatFileSize(size?: number | null) {
  if (!size) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function getPublicAssetUrl(asset: Pick<Asset, "storageType" | "url" | "path">) {
  if (asset.storageType === "EXTERNAL_URL") return asset.url || "";
  if (asset.url) return asset.url;
  return asset.path ? `/${asset.path.replace(/^\/+/, "")}` : "";
}
