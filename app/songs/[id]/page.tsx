import { AIGenerationKind, PublishContentType, PublishPlatform, ScheduledReleaseStatus, type AnalyticsSnapshot, type PublishEvent } from "@prisma/client";
import { notFound } from "next/navigation";
import { logPublishEvent, syncPublishEvent } from "@/actions/publish-actions";
import { assignSongToCampaign, markScheduledReleasePublished, scheduleRelease } from "@/actions/release-actions";
import { createAnalyticsSnapshot } from "@/actions/settings-actions";
import { applyAIGeneration, deleteSong, duplicateSong, generateMetadata, generateSongAI, markSongReady, updateSong } from "@/actions/song-actions";
import { AssetManager } from "@/components/asset-manager";
import { CopyButton } from "@/components/copy-button";
import { DownloadLink } from "@/components/download-link";
import { PageHeading } from "@/components/page-heading";
import { SongForm } from "@/components/song-form";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { buildSongExportPackets } from "@/lib/export-packets";
import { dateLabel } from "@/lib/format";
import { formatMetric, summarizeAnalytics } from "@/lib/integrations/analytics";
import { integrationStatuses } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";
import { getPublicAssetUrl } from "@/lib/asset-utils";
import { releaseRecommendation } from "@/lib/release-recommendations";

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ assetError?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const [song, playlists, logs, publishEvents, campaigns, analyticsSnapshots] = await Promise.all([
    prisma.song.findUnique({
      where: { id },
      include: {
        tags: true,
        playlistSongs: true,
        assets: { orderBy: { createdAt: "desc" } },
        campaignItems: { include: { campaign: true }, orderBy: { createdAt: "desc" } },
        scheduledReleases: { include: { campaign: true }, orderBy: { scheduledFor: "asc" } },
        aiGenerationLogs: { orderBy: { createdAt: "desc" }, take: 5 },
        publishEvents: true
      }
    }),
    prisma.playlist.findMany({ orderBy: { title: "asc" } }),
    prisma.aIGenerationLog.findMany({ where: { songId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.publishEvent.findMany({ where: { songId: id }, orderBy: { publishedAt: "desc" }, take: 12 }),
    prisma.releaseCampaign.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.analyticsSnapshot.findMany({ where: { songId: id }, orderBy: { snapshotDate: "desc" }, take: 12 })
  ]);
  if (!song) notFound();

  const readiness = songReadiness(song);
  const recommendation = releaseRecommendation(song);
  const packets = buildSongExportPackets(song);
  const publishPacket = packets.publishPacket;
  const textBundle = [
    song.title,
    "",
    "Hook:",
    song.hookText || "",
    "",
    "Short version:",
    song.shortVersion || "",
    "",
    "Website excerpt:",
    song.websiteExcerpt || "",
    "",
    "YouTube title:",
    song.youtubeTitle || "",
    "",
    "YouTube description:",
    song.youtubeDescription || "",
    "",
    "Full lyrics:",
    song.fullLyrics || ""
  ].join("\n");
  const latestAnalytics = summarizeAnalytics(analyticsSnapshots);
  const integrationStatus = integrationStatuses();

  return (
    <>
      <PageHeading
        title={song.title}
        subtitle={`Last updated ${dateLabel(song.updatedAt)} - slug ${song.slug}`}
        action={<a href="#ai-studio" className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink hover:bg-rose/90">AI Studio</a>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="order-2 space-y-6 xl:order-1">
          <Card>
            <SongForm song={song} playlists={playlists} action={updateSong.bind(null, song.id)} submitLabel="Save changes" />
          </Card>
          <Card>
            <AssetManager
              songId={song.id}
              initialAssets={song.assets.map((asset) => ({ ...asset, publicUrl: getPublicAssetUrl(asset) }))}
            />
            {query.assetError ? (
              <p className="mt-4 rounded-lg bg-red-500/12 p-3 text-sm text-red-100 ring-1 ring-red-300/20">
                Last upload error: {decodeURIComponent(query.assetError.replaceAll("+", " "))}
              </p>
            ) : null}
          </Card>
          <PublishingPanel songId={song.id} events={publishEvents} />
          <ReleasePlanningPanel songId={song.id} songTitle={song.title} campaigns={campaigns} campaignItems={song.campaignItems} scheduledReleases={song.scheduledReleases} />
          <AnalyticsPanel songId={song.id} events={publishEvents} snapshots={analyticsSnapshots} />
        </div>

        <div className="order-1 space-y-6 xl:order-2">
          <Card>
            <CardTitle title="Queue Status" eyebrow={recommendation.label} />
            <p className="text-sm text-mist/65">Score {recommendation.score}. {recommendation.suggestions[0] || "Review this song for the next release move."}</p>
            <div className="mt-3 flex flex-wrap gap-2">{recommendation.suggestions.map((suggestion) => <Pill key={suggestion}>{suggestion}</Pill>)}</div>
          </Card>
          <Card>
            <CardTitle title="Readiness Checklist" eyebrow={readiness.fullyPublishable ? "fully publishable" : "needs attention"} />
            <div className="space-y-2">
              {[
                ["Lyrics", readiness.hasLyrics],
                ["Short version", readiness.hasShortVersion],
                ["Full audio", readiness.hasFullAudio],
                ["Short audio", readiness.hasShortAudio],
                ["YouTube metadata", readiness.hasYoutubeMetadata],
                ["Website excerpt", readiness.hasExcerpt],
                ["Cover art", readiness.hasCoverArt]
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-mist/75">{label}</span>
                  <span className={ok ? "text-moss" : "text-rose"}>{ok ? "Ready" : "Missing"}</span>
                </div>
              ))}
            </div>
            {readiness.missing.length ? <div className="mt-3 flex flex-wrap gap-2">{readiness.missing.map((item) => <Pill key={item}>{item}</Pill>)}</div> : null}
          </Card>

          <Card id="ai-studio">
            <CardTitle title="AI Studio" eyebrow="mock now, Groq-ready" />
            <p className="mb-4 text-sm leading-6 text-mist/65">Generate creator-ready drafts, review them below, then apply only the ones that feel right.</p>
            <form action={generateMetadata.bind(null, song.id)}>
              <Button type="submit" className="w-full">Generate all metadata</Button>
            </form>
            <div className="mt-3 grid gap-2">
              {[
                [AIGenerationKind.YOUTUBE_TITLE, "YouTube title"],
                [AIGenerationKind.YOUTUBE_DESCRIPTION, "YouTube description"],
                [AIGenerationKind.SHORT_VERSION, "Suspiro short"],
                [AIGenerationKind.EXCERPT, "Website excerpt"],
                [AIGenerationKind.HOOK_TEXT, "Hook text"],
                [AIGenerationKind.TAGS, "Tags"]
              ].map(([kind, label]) => (
                <form key={kind} action={generateSongAI.bind(null, song.id, kind as AIGenerationKind)}>
                  <Button type="submit" variant="secondary" className="w-full">{label}</Button>
                </form>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-xs text-mist/55">
              <p>YouTube title: {song.youtubeTitle?.length ?? 0}/100</p>
              <p>Description: {song.youtubeDescription?.length ?? 0} characters</p>
            </div>
          </Card>

          <Card>
            <CardTitle title="Quick Actions" />
            <div className="grid gap-2">
              <form action={markSongReady.bind(null, song.id)}>
                <Button type="submit" variant="secondary" className="w-full" disabled={!readiness.readyForYoutube && !readiness.readyForWebsite}>Mark as ready</Button>
              </form>
              <form action={duplicateSong.bind(null, song.id)}><Button type="submit" variant="secondary" className="w-full">Duplicate song</Button></form>
              <form action={deleteSong.bind(null, song.id)}><Button type="submit" variant="danger" className="w-full">Delete song</Button></form>
            </div>
          </Card>

          <Card>
            <CardTitle title="Export Tools" />
            <div className="grid gap-2">
              <ExportRow label="YouTube title" value={song.youtubeTitle} />
              <ExportRow label="YouTube description" value={song.youtubeDescription} />
              <ExportRow label="Website excerpt" value={song.websiteExcerpt} />
              <ExportRow label="Short version" value={song.shortVersion} />
              <ExportRow label="Full lyrics" value={song.fullLyrics} />
              <ExportRow label="Text bundle" value={textBundle} />
              <ExportRow label="Publish packet JSON" value={JSON.stringify(publishPacket, null, 2)} />
              <ExportRow label="YouTube packet JSON" value={JSON.stringify(packets.youtubePacket, null, 2)} />
              <ExportRow label="Website packet JSON" value={JSON.stringify(packets.websitePacket, null, 2)} />
              <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className="text-sm text-mist/70">Download publish packet</span>
                <DownloadLink label="Download" filename={`${song.slug}-publish-packet.json`} content={JSON.stringify(publishPacket, null, 2)} />
              </div>
            </div>
          </Card>

          <IntegrationPanel events={publishEvents} integrationStatus={integrationStatus} latestAnalytics={latestAnalytics} websiteUrl={song.publishEvents.find((event) => event.platform === PublishPlatform.WEBSITE)?.externalUrl || null} />

          <Card>
            <CardTitle title="AI History" />
            {logs.length ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gold">{log.kind.replaceAll("_", " ")} - {log.provider}</p>
                        <p className="mt-1 text-xs text-mist/55">{dateLabel(log.createdAt)} {log.accepted ? "- accepted" : ""}</p>
                      </div>
                      <CopyButton value={log.result} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mist/75">{log.result}</p>
                    <form action={applyAIGeneration.bind(null, log.id)} className="mt-3">
                      <Button type="submit" variant="secondary">Use this</Button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mist/60">No generated drafts yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

type PublishItem = PublishEvent;
type SongCampaignItem = {
  id: string;
  campaignId: string;
  itemType: string;
  campaign: { title: string };
};
type SongScheduledRelease = {
  id: string;
  title: string;
  platform: PublishPlatform;
  contentType: PublishContentType;
  status: ScheduledReleaseStatus;
  scheduledFor: Date | null;
  campaign: { title: string } | null;
};

function PublishingPanel({ songId, events }: { songId: string; events: PublishItem[] }) {
  return (
    <Card>
      <CardTitle title="Publish History" eyebrow={`${events.length} events`} />
      <form action={logPublishEvent.bind(null, songId)} className="grid gap-3 rounded-lg bg-white/5 p-4 md:grid-cols-2">
        <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>
          {Object.values(PublishPlatform).map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select name="contentType" className={inputClass()} defaultValue={PublishContentType.SHORT}>
          {Object.values(PublishContentType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
        <input name="publishedAt" type="datetime-local" className={inputClass()} />
        <input name="url" type="url" className={inputClass()} placeholder="https://..." />
        <textarea name="notes" rows={2} className={inputClass("md:col-span-2")} placeholder="Notes" />
        <Button type="submit">Log publish event</Button>
      </form>
      <div className="mt-5 space-y-3">
        {events.length ? events.map((event) => (
          <div key={event.id} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{event.platform} - {event.contentType.replaceAll("_", " ")}</p>
              <p className="text-xs text-mist/50">{dateLabel(event.publishedAt)}</p>
            </div>
            {event.externalUrl || event.url ? <a href={event.externalUrl || event.url || "#"} target="_blank" className="mt-2 inline-block text-sm text-rose hover:text-rose/80">{event.externalUrl || event.url}</a> : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {event.externalId ? <Pill>{event.externalId}</Pill> : null}
              <Pill>{event.syncStatus}</Pill>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {event.thumbnailUrl ? <img src={event.thumbnailUrl} alt="" className="mt-3 h-20 w-36 rounded-lg object-cover" /> : null}
            {event.notes ? <p className="mt-2 text-sm text-mist/60">{event.notes}</p> : null}
            {event.syncError ? <p className="mt-2 text-xs text-red-200">{event.syncError}</p> : null}
            <form action={syncPublishEvent.bind(null, event.id)} className="mt-3">
              <Button type="submit" variant="secondary">Sync status</Button>
            </form>
          </div>
        )) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">No publish events yet.</p>}
      </div>
    </Card>
  );
}

function ReleasePlanningPanel({
  songId,
  songTitle,
  campaigns,
  campaignItems,
  scheduledReleases
}: {
  songId: string;
  songTitle: string;
  campaigns: Array<{ id: string; title: string }>;
  campaignItems: SongCampaignItem[];
  scheduledReleases: SongScheduledRelease[];
}) {
  return (
    <Card>
      <CardTitle title="Release Planning" eyebrow={`${scheduledReleases.length} scheduled`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg bg-white/5 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Campaign Membership</p>
          {campaignItems.length ? campaignItems.map((item) => (
            <a key={item.id} href={`/campaigns/${item.campaignId}`} className="mb-2 block rounded-lg bg-ink/35 p-3 text-sm text-mist hover:text-rose">
              {item.campaign.title} - {item.itemType.replaceAll("_", " ")}
            </a>
          )) : <p className="text-sm text-mist/60">No campaign yet. Place this song inside a release arc when it has a direction.</p>}
          <form action={assignSongToCampaign.bind(null, songId)} className="mt-4 space-y-3">
            <select name="campaignId" className={inputClass()} defaultValue="">
              <option value="" disabled>Choose campaign</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
            </select>
            <select name="itemType" className={inputClass()} defaultValue="SONG">
              <option value="SONG">Song</option>
              <option value="SHORT">Short</option>
              <option value="WEBSITE_POST">Website post</option>
              <option value="EXCERPT">Excerpt</option>
              <option value="OTHER">Other</option>
            </select>
            <Button type="submit" variant="secondary">Add to campaign</Button>
          </form>
        </div>
        <form action={scheduleRelease} className="space-y-3 rounded-lg bg-white/5 p-4">
          <input type="hidden" name="songId" value={songId} />
          <p className="text-sm font-semibold text-white">Schedule this song</p>
          <input name="title" defaultValue={songTitle} className={inputClass()} />
          <input name="scheduledFor" type="datetime-local" className={inputClass()} />
          <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>{Object.values(PublishPlatform).map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select>
          <select name="contentType" className={inputClass()} defaultValue={PublishContentType.SHORT}>{Object.values(PublishContentType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
          <select name="status" className={inputClass()} defaultValue={ScheduledReleaseStatus.PLANNED}>{Object.values(ScheduledReleaseStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select name="campaignId" className={inputClass()} defaultValue=""><option value="">No campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select>
          <Button type="submit">Schedule</Button>
        </form>
      </div>
      <div className="mt-5 space-y-3">
        {scheduledReleases.length ? scheduledReleases.map((release) => (
          <div key={release.id} className="rounded-lg bg-white/5 p-3">
            <p className="font-medium text-white">{release.title}</p>
            <p className="text-sm text-mist/55">{release.platform} - {release.contentType.replaceAll("_", " ")} - {release.scheduledFor ? dateLabel(release.scheduledFor) : "unscheduled"}</p>
            <p className="text-xs text-gold">{release.status}{release.campaign ? ` - ${release.campaign.title}` : ""}</p>
            {release.status !== "PUBLISHED" ? <form action={markScheduledReleasePublished.bind(null, release.id)} className="mt-2"><Button type="submit" variant="secondary">Mark published</Button></form> : null}
          </div>
        )) : <p className="rounded-lg bg-white/5 p-3 text-sm text-mist/60">Nothing scheduled yet.</p>}
      </div>
    </Card>
  );
}

function ExportRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
      <span className="text-sm text-mist/70">{label}</span>
      <CopyButton value={value || ""} />
    </div>
  );
}

function AnalyticsPanel({ songId, events, snapshots }: { songId: string; events: PublishItem[]; snapshots: AnalyticsSnapshot[] }) {
  return (
    <Card>
      <CardTitle title="Analytics" eyebrow={`${snapshots.length} snapshots`} />
      <form action={createAnalyticsSnapshot.bind(null, songId)} className="grid gap-3 rounded-lg bg-white/5 p-4 md:grid-cols-2">
        <select name="platform" className={inputClass()} defaultValue={PublishPlatform.YOUTUBE}>
          {Object.values(PublishPlatform).map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select name="publishEventId" className={inputClass()} defaultValue="">
          <option value="">No publish event</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.platform} - {dateLabel(event.publishedAt)}</option>)}
        </select>
        <input name="snapshotDate" type="date" className={inputClass()} />
        <input name="views" type="number" min="0" className={inputClass()} placeholder="Views" />
        <input name="likes" type="number" min="0" className={inputClass()} placeholder="Likes" />
        <input name="comments" type="number" min="0" className={inputClass()} placeholder="Comments" />
        <input name="shares" type="number" min="0" className={inputClass()} placeholder="Shares" />
        <input name="watchTime" type="number" min="0" className={inputClass()} placeholder="Watch time (minutes)" />
        <input name="ctr" type="number" min="0" step="0.01" className={inputClass()} placeholder="CTR %" />
        <input name="retention" type="number" min="0" step="0.01" className={inputClass()} placeholder="Retention %" />
        <Button type="submit">Save snapshot</Button>
      </form>
      <div className="mt-5 space-y-3">
        {snapshots.length ? snapshots.map((snapshot) => (
          <div key={snapshot.id} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{snapshot.platform}</p>
              <p className="text-xs text-mist/50">{dateLabel(snapshot.snapshotDate)}</p>
            </div>
            <p className="mt-2 text-sm text-mist/65">
              Views {formatMetric(snapshot.views)} · Likes {formatMetric(snapshot.likes)} · Comments {formatMetric(snapshot.comments)} · Watch time {formatMetric(snapshot.watchTime)}
            </p>
          </div>
        )) : <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/60">No analytics snapshots yet.</p>}
      </div>
    </Card>
  );
}

function IntegrationPanel({
  events,
  integrationStatus,
  latestAnalytics,
  websiteUrl
}: {
  events: PublishItem[];
  integrationStatus: ReturnType<typeof integrationStatuses>;
  latestAnalytics: ReturnType<typeof summarizeAnalytics>;
  websiteUrl: string | null;
}) {
  const youtubeEvent = events.find((event) => event.platform === PublishPlatform.YOUTUBE);
  return (
    <Card>
      <CardTitle title="External Status" eyebrow="sync foundations" />
      <div className="space-y-3">
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">YouTube</p>
          <p className="mt-1 text-sm text-mist/65">{youtubeEvent?.externalUrl || "No YouTube link yet."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>{youtubeEvent?.syncStatus || "NONE"}</Pill>
            {youtubeEvent?.externalId ? <Pill>{youtubeEvent.externalId}</Pill> : null}
          </div>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Website</p>
          <p className="mt-1 text-sm text-mist/65">{websiteUrl || "No website link yet."}</p>
        </div>
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Latest analytics</p>
          <p className="mt-1 text-sm text-mist/65">
            {latestAnalytics ? `${latestAnalytics.platform} · ${formatMetric(latestAnalytics.views)} views · ${latestAnalytics.capturedAt ? dateLabel(latestAnalytics.capturedAt) : "undated"}` : "No performance snapshots yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {integrationStatus.map((status) => <Pill key={status.id}>{status.label}: {status.mode}</Pill>)}
        </div>
      </div>
    </Card>
  );
}
