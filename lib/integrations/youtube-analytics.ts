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

export async function fetchYoutubeAnalytics(videoId: string): Promise<YoutubeAnalyticsImportResult | null> {
  const config = appConfig();
  if (!config.analyticsImportEnabled || !config.youtubeApiKey) return null;

  const query = new URLSearchParams({
    part: "statistics",
    id: videoId,
    key: config.youtubeApiKey
  });

  try {
    const response = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?${query.toString()}`, {}, config.syncTimeoutMs);
    if (!response.ok) return null;
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
    if (!item?.id) return null;
    return {
      views: parseCount(item.statistics?.viewCount),
      likes: parseCount(item.statistics?.likeCount),
      comments: parseCount(item.statistics?.commentCount),
      rawJson: payload as Prisma.InputJsonValue
    };
  } catch {
    return null;
  }
}

export async function syncAnalyticsSnapshotForEvent(songId: string, publishEventId: string, snapshotDate = new Date()) {
  const event = await prisma.publishEvent.findUnique({
    where: { id: publishEventId }
  });
  if (!event || event.songId !== songId || event.platform !== PublishPlatform.YOUTUBE) return null;

  const videoId = event.externalId || extractYoutubeVideoId(event.externalUrl || event.url);
  if (!videoId) return null;

  const imported = await fetchYoutubeAnalytics(videoId);
  if (!imported) return null;

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
