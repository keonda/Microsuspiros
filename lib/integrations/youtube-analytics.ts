import { PublishPlatform, type Prisma } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { extractYoutubeVideoId } from "@/lib/integrations/youtube";

export type YoutubeAnalyticsImportResult = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  rawJson?: Prisma.InputJsonValue;
};

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYoutubeAnalytics(videoId: string): Promise<YoutubeAnalyticsImportResult> {
  const config = appConfig();
  if (!config.analyticsImportEnabled) {
    throw new Error("Analytics import is disabled. Set ANALYTICS_IMPORT_ENABLED=true.");
  }
  if (!config.youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY is missing.");
  }

  const query = new URLSearchParams({
    part: "statistics",
    id: videoId,
    key: config.youtubeApiKey
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${query.toString()}`, {}, config.syncTimeoutMs);
  } catch {
    throw new Error("YouTube stats request timed out.");
  }

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`YouTube stats request failed (${response.status}). ${message.slice(0, 120)}`.trim());
  }

  const payload = await response.json() as {
    items?: Array<{
      id: string;
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }>;
  };

  const item = payload.items?.[0];
  if (!item?.id) {
    throw new Error("No YouTube statistics were returned for that video. Check the video ID and API access.");
  }

  return {
    views: parseCount(item.statistics?.viewCount),
    likes: parseCount(item.statistics?.likeCount),
    comments: parseCount(item.statistics?.commentCount),
    rawJson: payload as Prisma.InputJsonValue
  };
}

export async function syncAnalyticsSnapshotForEvent(songId: string, publishEventId: string, snapshotDate = new Date()) {
  const event = await prisma.publishEvent.findUnique({
    where: { id: publishEventId }
  });
  if (!event || event.songId !== songId || event.platform !== PublishPlatform.YOUTUBE) {
    throw new Error("Choose a valid YouTube publish event first.");
  }

  const videoId = event.externalId || extractYoutubeVideoId(event.externalUrl || event.url);
  if (!videoId) {
    throw new Error("That publish event does not have a valid YouTube video ID or URL.");
  }

  const imported = await fetchYoutubeAnalytics(videoId);

  const existing = await prisma.analyticsSnapshot.findFirst({
    where: {
      songId,
      publishEventId,
      platform: PublishPlatform.YOUTUBE,
      snapshotDate: {
        gte: startOfDay(snapshotDate),
        lt: endOfDay(snapshotDate)
      }
    },
    orderBy: { snapshotDate: "desc" }
  });

  const data = {
    songId,
    publishEventId,
    platform: PublishPlatform.YOUTUBE,
    snapshotDate,
    views: imported.views,
    likes: imported.likes,
    comments: imported.comments,
    rawJson: imported.rawJson ?? undefined
  };

  if (existing) {
    return prisma.analyticsSnapshot.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.analyticsSnapshot.create({ data });
}

function parseCount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}
