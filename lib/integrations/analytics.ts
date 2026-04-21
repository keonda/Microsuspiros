import { PublishPlatform, type AnalyticsSnapshot } from "@prisma/client";
import { appConfig } from "@/lib/config";
import type { AnalyticsSummary, IntegrationStatus } from "@/lib/integrations/types";

export function analyticsIntegrationStatus(): IntegrationStatus {
  const config = appConfig();
  const enabled = config.analyticsImportEnabled;
  return {
    id: "analytics",
    label: "Analytics Import",
    enabled,
    configured: enabled,
    mode: enabled ? "mock" : "disabled",
    warning: enabled ? "Manual entry is available now. API imports can be layered in later." : undefined
  };
}

export function summarizeAnalytics(snapshots: AnalyticsSnapshot[]): AnalyticsSummary | null {
  if (!snapshots.length) return null;
  const sorted = [...snapshots].sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());
  const latest = sorted[0];
  return {
    platform: latest.platform,
    views: latest.views ?? 0,
    likes: latest.likes ?? 0,
    comments: latest.comments ?? 0,
    shares: latest.shares ?? 0,
    watchTime: latest.watchTime ?? 0,
    ctr: latest.ctr,
    retention: latest.retention,
    capturedAt: latest.snapshotDate
  };
}

export function formatMetric(value: number | null | undefined) {
  if (value == null) return "0";
  return new Intl.NumberFormat("en").format(value);
}

export function analyticsPlatformLabel(platform: PublishPlatform) {
  return platform.replaceAll("_", " ");
}
