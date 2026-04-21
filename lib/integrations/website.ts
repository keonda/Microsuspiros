import { ExternalSyncStatus } from "@prisma/client";
import { appConfig } from "@/lib/config";
import type { IntegrationStatus, PublishSyncResult } from "@/lib/integrations/types";

export function websiteIntegrationStatus(): IntegrationStatus {
  const config = appConfig();
  const configured = Boolean(config.websiteSyncEnabled && config.websiteApiUrl);
  return {
    id: "website",
    label: "Website",
    enabled: config.websiteSyncEnabled,
    configured,
    mode: configured ? "enabled" : config.websiteSyncEnabled ? "mock" : "disabled",
    warning: config.websiteSyncEnabled && !config.websiteApiUrl ? "Website sync is enabled, but WEBSITE_API_URL is missing." : undefined
  };
}

export function extractWebsiteExternalId(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last || null;
  } catch {
    return null;
  }
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

export async function syncWebsitePublish(url: string | null | undefined, payload?: Record<string, unknown>): Promise<PublishSyncResult> {
  const config = appConfig();
  const externalId = extractWebsiteExternalId(url);

  if (!config.websiteSyncEnabled || !config.websiteApiUrl) {
    return {
      syncStatus: url ? ExternalSyncStatus.LINKED : ExternalSyncStatus.NONE,
      externalId,
      externalUrl: url || null,
      syncError: null
    };
  }

  try {
    const response = await fetchWithTimeout(config.websiteApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.websiteApiKey ? { Authorization: `Bearer ${config.websiteApiKey}` } : {})
      },
      body: JSON.stringify({ url, payload, mode: "sync-check" })
    }, config.syncTimeoutMs);

    if (!response.ok) {
      return {
        syncStatus: ExternalSyncStatus.ERROR,
        externalId,
        externalUrl: url || null,
        syncError: `Website sync returned ${response.status}.`
      };
    }

    const result = await response.json() as { id?: string; url?: string };
    return {
      syncStatus: ExternalSyncStatus.SYNCED,
      externalId: result.id || externalId,
      externalUrl: result.url || url || null,
      syncError: null
    };
  } catch {
    return {
      syncStatus: ExternalSyncStatus.ERROR,
      externalId,
      externalUrl: url || null,
      syncError: "Website sync timed out or failed."
    };
  }
}
