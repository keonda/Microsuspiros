import { ExternalSyncStatus } from "@prisma/client";
import { appConfig } from "@/lib/config";
import type { IntegrationStatus, PublishSyncResult, YouTubeVideoMetadata } from "@/lib/integrations/types";

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function extractYoutubeVideoId(value: string | null | undefined) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  const url = safeUrl(raw);
  if (!url) return null;

  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (url.searchParams.get("v")) {
    return url.searchParams.get("v");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
  if (marker >= 0) {
    return parts[marker + 1] ?? null;
  }

  return null;
}

export function normalizeYoutubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeIntegrationStatus(): IntegrationStatus {
  const config = appConfig();
  const configured = Boolean(config.youtubeSyncEnabled && config.youtubeApiKey);
  return {
    id: "youtube",
    label: "YouTube",
    enabled: config.youtubeSyncEnabled,
    configured,
    mode: configured ? "enabled" : config.youtubeSyncEnabled ? "mock" : "disabled",
    warning: config.youtubeSyncEnabled && !config.youtubeApiKey ? "Sync is enabled, but YOUTUBE_API_KEY is missing." : undefined
  };
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYoutubeVideoMetadata(videoId: string): Promise<YouTubeVideoMetadata | null> {
  const config = appConfig();
  if (!config.youtubeSyncEnabled || !config.youtubeApiKey) return null;

  const query = new URLSearchParams({
    part: "snippet",
    id: videoId,
    key: config.youtubeApiKey
  });

  try {
    const response = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${query.toString()}`, {}, config.syncTimeoutMs);
    if (!response.ok) return null;
    const payload = await response.json() as {
      items?: Array<{ id: string; snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> } }>;
    };
    const item = payload.items?.[0];
    if (!item?.id) return null;

    return {
      videoId: item.id,
      title: item.snippet?.title || "Untitled YouTube video",
      publishedAt: item.snippet?.publishedAt,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || youtubeThumbnailUrl(item.id),
      url: normalizeYoutubeUrl(item.id)
    };
  } catch {
    return null;
  }
}

export async function syncYoutubePublish(urlOrId: string | null | undefined): Promise<PublishSyncResult> {
  const videoId = extractYoutubeVideoId(urlOrId);
  if (!videoId) {
    return { syncStatus: ExternalSyncStatus.ERROR, syncError: "No valid YouTube video ID found." };
  }

  const normalizedUrl = normalizeYoutubeUrl(videoId);
  const metadata = await fetchYoutubeVideoMetadata(videoId);

  return {
    syncStatus: metadata ? ExternalSyncStatus.SYNCED : ExternalSyncStatus.LINKED,
    externalId: videoId,
    externalUrl: metadata?.url || normalizedUrl,
    thumbnailUrl: metadata?.thumbnailUrl || youtubeThumbnailUrl(videoId),
    syncError: null,
    meta: metadata ? { title: metadata.title, publishedAt: metadata.publishedAt } : undefined
  };
}
