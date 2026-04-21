import type { ExternalSyncStatus, PublishPlatform } from "@prisma/client";

export type IntegrationMode = "disabled" | "mock" | "enabled";

export type IntegrationStatus = {
  id: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  mode: IntegrationMode;
  warning?: string;
};

export type YouTubeVideoMetadata = {
  videoId: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  url: string;
};

export type PublishSyncResult = {
  syncStatus: ExternalSyncStatus;
  externalId?: string | null;
  externalUrl?: string | null;
  thumbnailUrl?: string | null;
  syncError?: string | null;
  meta?: Record<string, unknown>;
};

export type AnalyticsSummary = {
  platform: PublishPlatform;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchTime: number;
  ctr?: number | null;
  retention?: number | null;
  capturedAt?: Date | null;
};
