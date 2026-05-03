import { IntegrationKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

const cacheMs = 1000 * 60 * 5;
const safeUrl = z.string().trim().url();

export type MediaSummary = {
  kind: IntegrationKind;
  name: string;
  enabled: boolean;
  status: "disabled" | "online" | "offline" | "error";
  error?: string;
  lastUpdated?: string;
  stats: Record<string, number | string | boolean | null>;
  sections: { title: string; items: string[] }[];
};

export async function saveIntegrationSettings(formData: FormData) {
  for (const kind of ["plex", "sonarr", "radarr"] as const) {
    const enabled = formData.get(`${kind}Enabled`) === "on";
    const name = String(formData.get(`${kind}Name`) || labelFor(kind)).trim();
    const baseUrlRaw = String(formData.get(`${kind}Url`) || "").trim();
    const token = String(formData.get(`${kind}Token`) || formData.get(`${kind}ApiKey`) || "").trim();
    if (!baseUrlRaw && !enabled && !token) continue;
    const baseUrl = safeUrl.parse(baseUrlRaw);
    const integration = await prisma.integration.upsert({
      where: { kind },
      create: { kind, name, baseUrl: trimSlash(baseUrl), enabled },
      update: { name, baseUrl: trimSlash(baseUrl), enabled }
    });
    if (token) {
      await prisma.integrationCredential.upsert({
        where: { integrationId_key: { integrationId: integration.id, key: credentialKey(kind) } },
        create: { integrationId: integration.id, key: credentialKey(kind), value: encryptSecret(token) },
        update: { value: encryptSecret(token) }
      });
    }
  }
}

export async function getIntegration(kind: IntegrationKind) {
  return prisma.integration.findUnique({
    where: { kind },
    include: { credentials: true, caches: true }
  });
}

export async function getConfiguredIntegrations() {
  const integrations = await prisma.integration.findMany({ orderBy: { kind: "asc" }, include: { caches: true } });
  return integrations.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    baseUrl: item.baseUrl,
    enabled: item.enabled,
    lastStatus: item.lastStatus,
    lastError: item.lastError,
    lastChecked: item.lastChecked,
    hasCredential: false
  }));
}

export async function getOverview(kind: IntegrationKind, refresh = false): Promise<MediaSummary> {
  const integration = await getIntegration(kind);
  if (!integration) return disabledSummary(kind, `${labelFor(kind)} is not configured.`);
  if (!integration.enabled) return disabledSummary(kind, `${integration.name} is disabled.`, integration.name);

  const cached = integration.caches.find((item) => item.key === "overview");
  if (!refresh && cached && Date.now() - cached.updatedAt.getTime() < cacheMs) {
    return cached.data as unknown as MediaSummary;
  }

  const summary = await fetchOverview(integration);
  await prisma.integrationCache.upsert({
    where: { integrationId_key: { integrationId: integration.id, key: "overview" } },
    create: { integrationId: integration.id, key: "overview", data: summary as unknown as Prisma.InputJsonValue },
    update: { data: summary as unknown as Prisma.InputJsonValue }
  });
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastStatus: summary.status,
      lastError: summary.error ?? null,
      lastChecked: new Date()
    }
  });
  return summary;
}

export async function getAllMediaOverview(refresh = false) {
  const [plex, sonarr, radarr] = await Promise.all([
    getOverview("plex", refresh),
    getOverview("sonarr", refresh),
    getOverview("radarr", refresh)
  ]);
  return { plex, sonarr, radarr, refreshedAt: new Date().toISOString() };
}

export async function getMediaAssistantSummary() {
  const overview = await getAllMediaOverview(false);
  return {
    plex: summarizeForAi(overview.plex),
    sonarr: summarizeForAi(overview.sonarr),
    radarr: summarizeForAi(overview.radarr)
  };
}

async function fetchOverview(integration: Awaited<ReturnType<typeof getIntegration>>): Promise<MediaSummary> {
  if (!integration) throw new Error("Integration missing.");
  try {
    const credential = getCredential(integration);
    if (integration.kind === "plex") return await plexOverview(integration.name, integration.baseUrl, credential);
    if (integration.kind === "sonarr") return await arrOverview("sonarr", integration.name, integration.baseUrl, credential);
    return await arrOverview("radarr", integration.name, integration.baseUrl, credential);
  } catch (error) {
    return {
      kind: integration.kind,
      name: integration.name,
      enabled: integration.enabled,
      status: "error",
      error: friendlyError(error),
      lastUpdated: new Date().toISOString(),
      stats: {},
      sections: []
    };
  }
}

async function plexOverview(name: string, baseUrl: string, token: string): Promise<MediaSummary> {
  const [identity, libraries, recent, sessions] = await Promise.all([
    plexFetch(baseUrl, "/identity", token),
    plexFetch(baseUrl, "/library/sections", token),
    plexFetch(baseUrl, "/library/recentlyAdded", token),
    plexFetch(baseUrl, "/status/sessions", token)
  ]);
  const libraryNames = [...libraries.matchAll(/<Directory[^>]+title="([^"]+)"[^>]*type="([^"]+)"/g)].map((match) => `${decodeXml(match[1])} (${match[2]})`);
  const recentItems = [...recent.matchAll(/<(?:Video|Directory)[^>]+title="([^"]+)"[^>]*(?:grandparentTitle="([^"]+)")?[^>]*>/g)]
    .slice(0, 8)
    .map((match) => decodeXml(match[2] ? `${match[2]} - ${match[1]}` : match[1]));
  const activeStreams = Number(sessions.match(/size="(\d+)"/)?.[1] ?? 0);
  return {
    kind: "plex",
    name,
    enabled: true,
    status: identity.includes("MediaContainer") ? "online" : "offline",
    lastUpdated: new Date().toISOString(),
    stats: { libraries: libraryNames.length, activeStreams },
    sections: [
      { title: "Libraries", items: libraryNames.slice(0, 8) },
      { title: "Recently added", items: recentItems },
      { title: "Active streams", items: activeStreams ? [`${activeStreams} active stream(s)`] : ["No active streams"] }
    ]
  };
}

async function arrOverview(kind: "sonarr" | "radarr", name: string, baseUrl: string, apiKey: string): Promise<MediaSummary> {
  const headers = { "X-Api-Key": apiKey };
  const now = new Date();
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const [status, queue, missing, calendar, collection] = await Promise.all([
    jsonFetch(`${baseUrl}/api/v3/system/status`, headers),
    jsonFetch(`${baseUrl}/api/v3/queue?page=1&pageSize=8`, headers),
    jsonFetch(`${baseUrl}/api/v3/wanted/missing?page=1&pageSize=8`, headers),
    jsonFetch(`${baseUrl}/api/v3/calendar?start=${now.toISOString()}&end=${soon.toISOString()}`, headers),
    jsonFetch(`${baseUrl}/api/v3/${kind === "sonarr" ? "series" : "movie"}`, headers)
  ]);
  const missingRecords = Array.isArray(missing?.records) ? missing.records : [];
  const queueRecords = Array.isArray(queue?.records) ? queue.records : [];
  const upcoming = Array.isArray(calendar) ? calendar : [];
  return {
    kind,
    name,
    enabled: true,
    status: "online",
    lastUpdated: new Date().toISOString(),
    stats: {
      version: status?.version ?? null,
      count: Array.isArray(collection) ? collection.length : 0,
      missing: Number(missing?.totalRecords ?? missingRecords.length),
      queue: Number(queue?.totalRecords ?? queueRecords.length)
    },
    sections: [
      { title: kind === "sonarr" ? "Wanted episodes" : "Wanted movies", items: missingRecords.slice(0, 8).map((item: any) => arrTitle(kind, item)) },
      { title: "Upcoming", items: upcoming.slice(0, 8).map((item: any) => arrTitle(kind, item)) },
      { title: "Download queue", items: queueRecords.slice(0, 8).map((item: any) => item.title ?? arrTitle(kind, item)) }
    ]
  };
}

export async function testIntegration(kind: IntegrationKind) {
  const summary = await getOverview(kind, true);
  return { ok: summary.status === "online", summary };
}

function getCredential(integration: NonNullable<Awaited<ReturnType<typeof getIntegration>>>) {
  const item = integration.credentials.find((credential) => credential.key === credentialKey(integration.kind));
  if (!item) throw new Error(`${labelFor(integration.kind)} credentials are missing.`);
  return decryptSecret(item.value);
}

async function plexFetch(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}?X-Plex-Token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Plex returned ${response.status}.`);
  return response.text();
}

async function jsonFetch(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Server returned ${response.status}.`);
  return response.json();
}

function summarizeForAi(summary: MediaSummary) {
  return {
    name: summary.name,
    enabled: summary.enabled,
    status: summary.status,
    error: summary.error,
    stats: summary.stats,
    sections: summary.sections.map((section) => ({ title: section.title, items: section.items.slice(0, 8) })),
    lastUpdated: summary.lastUpdated
  };
}

function disabledSummary(kind: IntegrationKind, error: string, name = labelFor(kind)): MediaSummary {
  return { kind, name, enabled: false, status: "disabled", error, stats: {}, sections: [], lastUpdated: new Date().toISOString() };
}

function arrTitle(kind: "sonarr" | "radarr", item: any) {
  if (kind === "sonarr") return item.series?.title && item.title ? `${item.series.title} - ${item.title}` : item.title ?? item.series?.title ?? "Untitled";
  return item.movie?.title ?? item.title ?? "Untitled";
}

function credentialKey(kind: IntegrationKind) {
  return kind === "plex" ? "token" : "apiKey";
}

function labelFor(kind: IntegrationKind) {
  return kind === "plex" ? "Plex" : kind === "sonarr" ? "Sonarr" : "Radarr";
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function decodeXml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to reach the server.";
  if (message.includes("401") || message.includes("403")) return "Credentials were rejected. Check the token/API key.";
  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) return "Server is offline or unreachable from this deployment.";
  return message;
}
