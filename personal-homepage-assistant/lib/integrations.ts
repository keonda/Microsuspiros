import { IntegrationKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

const cacheMs = 1000 * 60 * 5;
const safeUrl = z.string().trim().url();
const plexClientId = "personal-homepage-assistant";
const plexHeaders = {
  "X-Plex-Client-Identifier": plexClientId,
  "X-Plex-Product": "Personal Homepage Assistant",
  "X-Plex-Version": "1.0.0",
  "X-Plex-Platform": "Web",
  "X-Plex-Device": "Personal Homepage Assistant",
  Accept: "application/json"
};

export type MediaSectionItem = {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
};

export type MediaSummary = {
  kind: IntegrationKind;
  name: string;
  enabled: boolean;
  status: "disabled" | "online" | "offline" | "error";
  error?: string;
  lastUpdated?: string;
  stats: Record<string, number | string | boolean | null>;
  sections: { title: string; items: Array<string | MediaSectionItem> }[];
};

type PlexServerResource = {
  name: string;
  owned: boolean;
  uri: string;
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
  const [identity, libraries, recent, sessions, history, continueWatching] = await Promise.all([
    plexFetch(baseUrl, "/identity", token),
    plexFetch(baseUrl, "/library/sections", token),
    plexFetch(baseUrl, "/library/recentlyAdded", token),
    plexFetch(baseUrl, "/status/sessions", token),
    plexFetchOptional(baseUrl, "/status/sessions/history/all?sort=viewedAt:desc&X-Plex-Container-Size=8", token),
    plexFetchOptional(baseUrl, "/hubs/home/continueWatching", token)
  ]);
  const libraryNames = [...libraries.matchAll(/<Directory[^>]+title="([^"]+)"[^>]*type="([^"]+)"/g)].map((match) => `${decodeXml(match[1])} (${match[2]})`);
  const recentItems = plexVideoTitles(recent).slice(0, 8);
  const historyItems = plexVideoTitles(history).slice(0, 8);
  const continueItems = plexVideoTitles(continueWatching).slice(0, 8);
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
      { title: "Continue watching", items: continueItems },
      { title: "Recently watched", items: historyItems },
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
  const collectionLookup = buildCollectionLookup(kind, collection);
  const wantedItems = await enrichWithAniList(missingRecords.slice(0, 8).map((item: any) => arrItem(kind, item, collectionLookup)));
  const upcomingItems = await enrichWithAniList(upcoming.slice(0, 8).map((item: any) => arrItem(kind, item, collectionLookup)));
  const queueItems = await enrichWithAniList(queueRecords.slice(0, 8).map((item: any) => arrItem(kind, item, collectionLookup, item.title)));
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
      { title: kind === "sonarr" ? "Wanted episodes" : "Wanted movies", items: wantedItems },
      { title: "Upcoming", items: upcomingItems },
      { title: "Download queue", items: queueItems }
    ]
  };
}

export async function testIntegration(kind: IntegrationKind) {
  const summary = await getOverview(kind, true);
  return { ok: summary.status === "online", summary };
}

export async function createPlexPin() {
  const response = await fetch("https://plex.tv/api/v2/pins", {
    method: "POST",
    headers: plexHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Plex PIN request failed with ${response.status}.`);
  const data = await response.json();
  return {
    id: data.id,
    code: data.code,
    expiresAt: data.expiresAt,
    authUrl: `https://plex.tv/link?code=${encodeURIComponent(data.code)}`
  };
}

export async function checkPlexPin(pinId: number) {
  const response = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
    headers: plexHeaders,
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Plex PIN check failed with ${response.status}.`);
  const data = await response.json();
  if (!data.authToken) return { connected: false as const };

  const server = await fetchPlexServerResource(data.authToken);
  const integration = await prisma.integration.upsert({
    where: { kind: "plex" },
    create: {
      kind: "plex",
      name: server.name,
      baseUrl: server.uri,
      enabled: true,
      lastStatus: "online",
      lastChecked: new Date()
    },
    update: {
      name: server.name,
      baseUrl: server.uri,
      enabled: true,
      lastStatus: "online",
      lastError: null,
      lastChecked: new Date()
    }
  });
  await prisma.integrationCredential.upsert({
    where: { integrationId_key: { integrationId: integration.id, key: "token" } },
    create: { integrationId: integration.id, key: "token", value: encryptSecret(data.authToken) },
    update: { value: encryptSecret(data.authToken) }
  });
  await getOverview("plex", true);
  return { connected: true as const, server };
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

async function plexFetchOptional(baseUrl: string, path: string, token: string) {
  try {
    return await plexFetch(baseUrl, path, token);
  } catch {
    return "";
  }
}

function plexVideoTitles(xml: string) {
  return [...xml.matchAll(/<Video[^>]+title="([^"]+)"[^>]*(?:grandparentTitle="([^"]+)")?[^>]*(?:parentTitle="([^"]+)")?[^>]*>/g)].map((match) => {
    const title = decodeXml(match[1]);
    const grandparent = match[2] ? decodeXml(match[2]) : null;
    const parent = match[3] ? decodeXml(match[3]) : null;
    return [grandparent, parent, title].filter(Boolean).join(" - ");
  });
}

async function fetchPlexServerResource(token: string) {
  const response = await fetch("https://plex.tv/api/resources?includeHttps=1", {
    headers: { ...plexHeaders, "X-Plex-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Unable to fetch Plex servers (${response.status}).`);
  const text = await response.text();
  const servers = parsePlexResources(text);
  const server = servers.find((item) => item.owned && item.uri) ?? servers.find((item) => item.uri);
  if (!server) throw new Error("Plex login worked, but no reachable Plex Media Server was found.");
  return server;
}

function parsePlexResources(text: string): PlexServerResource[] {
  try {
    const data = JSON.parse(text);
    const devices = data.MediaContainer?.Device ?? data.devices ?? [];
    return devices.flatMap((device: any) => {
      const connections = Array.isArray(device.Connection) ? device.Connection : [];
      return connections.map((connection: any) => ({
        name: device.name ?? device.provides ?? "Plex Server",
        owned: device.owned === "1" || device.owned === 1 || device.owned === true,
        uri: connection.uri
      }));
    });
  } catch {
    return [...text.matchAll(/<Device[^>]+name="([^"]+)"[^>]*owned="([^"]*)"[^>]*>([\s\S]*?)<\/Device>/g)].flatMap((device) => {
      return [...device[3].matchAll(/<Connection[^>]+uri="([^"]+)"/g)].map((connection) => ({
        name: decodeXml(device[1]),
        owned: device[2] === "1",
        uri: decodeXml(connection[1])
      }));
    });
  }
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
    sections: summary.sections.map((section) => ({ title: section.title, items: section.items.slice(0, 8).map(itemTitle) })),
    lastUpdated: summary.lastUpdated
  };
}

function disabledSummary(kind: IntegrationKind, error: string, name = labelFor(kind)): MediaSummary {
  return { kind, name, enabled: false, status: "disabled", error, stats: {}, sections: [], lastUpdated: new Date().toISOString() };
}

function buildCollectionLookup(kind: "sonarr" | "radarr", collection: any) {
  const records = Array.isArray(collection) ? collection : [];
  return new Map(records.map((item: any) => [item.id, kind === "sonarr" ? item.title : movieTitle(item)]));
}

function arrTitle(kind: "sonarr" | "radarr", item: any, lookup: Map<any, string>, queueTitle?: string) {
  return arrItem(kind, item, lookup, queueTitle).title;
}

function arrItem(kind: "sonarr" | "radarr", item: any, lookup: Map<any, string>, queueTitle?: string): MediaSectionItem {
  if (kind === "sonarr") {
    const seriesTitle = item.series?.title ?? lookup.get(item.seriesId) ?? item.seriesTitle ?? queueTitle;
    const episodeTitle = item.title ?? item.episodeTitle;
    const episodeNumber = formatEpisodeNumber(item);
    return {
      title: seriesTitle ?? "Untitled anime",
      subtitle: [episodeNumber, episodeTitle].filter(Boolean).join(" - ") || null
    };
  }
  return { title: movieTitle(item.movie) ?? lookup.get(item.movieId) ?? movieTitle(item) ?? queueTitle ?? "Untitled movie" };
}

function formatEpisodeNumber(item: any) {
  const season = item.seasonNumber ?? item.episode?.seasonNumber;
  const episode = item.episodeNumber ?? item.episode?.episodeNumber;
  if (season === undefined || episode === undefined) return null;
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

function movieTitle(item: any) {
  if (!item) return null;
  const title = item.title ?? item.movie?.title;
  const year = item.year ?? item.movie?.year;
  return title && year ? `${title} (${year})` : title ?? null;
}

async function enrichWithAniList(items: MediaSectionItem[]) {
  const unique = [...new Map(items.map((item) => [cleanAniListSearchTitle(item.title), item.title])).entries()].slice(0, 8);
  const covers = new Map<string, Awaited<ReturnType<typeof fetchAniListCover>>>();
  await Promise.all(unique.map(async ([searchTitle, originalTitle]) => {
    const cover = await fetchAniListCover(searchTitle);
    if (cover) covers.set(originalTitle, cover);
  }));
  return items.map((item) => {
    const cover = covers.get(item.title);
    return cover ? { ...item, imageUrl: cover.imageUrl, sourceUrl: cover.sourceUrl } : item;
  });
}

async function fetchAniListCover(search: string) {
  if (!search || search.length < 2) return null;
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: `query ($search: String) {
          Media(search: $search, type: ANIME) {
            id
            siteUrl
            title { romaji english native }
            coverImage { medium large color }
          }
        }`,
        variables: { search }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const media = data?.data?.Media;
    const imageUrl = media?.coverImage?.large ?? media?.coverImage?.medium;
    return imageUrl ? { imageUrl, sourceUrl: media?.siteUrl ?? null } : null;
  } catch {
    return null;
  }
}

function cleanAniListSearchTitle(title: string) {
  return title.replace(/\(\d{4}\)/g, "").trim();
}

function itemTitle(item: string | MediaSectionItem) {
  return typeof item === "string" ? item : [item.title, item.subtitle].filter(Boolean).join(" - ");
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
