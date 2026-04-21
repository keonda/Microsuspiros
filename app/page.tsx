import Link from "next/link";
import { ArrowRight, CalendarDays, FileAudio, FileWarning, Flag, ListPlus, Music2, Radio, Sparkles } from "lucide-react";
import { ReleaseCampaignStatus, ScheduledReleaseStatus, SongStatus } from "@prisma/client";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";
import { DashboardSectionCard } from "@/components/dashboard/section-card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/ui/badge";
import { appConfig } from "@/lib/config";
import { dateLabel } from "@/lib/format";
import { integrationStatuses } from "@/lib/integrations";
import { formatMetric, summarizeAnalytics } from "@/lib/integrations/analytics";
import { prisma } from "@/lib/prisma";
import { buildReleaseQueue } from "@/lib/release-queue";
import { dashboardSectionCollapsed, dashboardSectionEnabled, resolveDashboardPreferences } from "@/lib/dashboard-preferences";
import { songReadiness } from "@/lib/song-readiness";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const config = appConfig();

  const [
    allSongs,
    playlistsCount,
    recentSongs,
    recentUpdated,
    recentAssets,
    recentPublishes,
    activeCampaigns,
    campaignPreview,
    upcomingReleases,
    overdueReleases,
    recentAnalytics,
    preference
  ] = await Promise.all([
    prisma.song.findMany({
      include: { assets: true, publishEvents: true, scheduledReleases: true, campaignItems: true, aiGenerationLogs: true, playlistSongs: true }
    }),
    prisma.playlist.count(),
    prisma.song.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { tags: true } }),
    prisma.song.findMany({ take: 5, orderBy: { updatedAt: "desc" }, include: { tags: true } }),
    prisma.asset.findMany({ take: 4, orderBy: { createdAt: "desc" }, include: { song: true } }),
    prisma.publishEvent.findMany({ take: 5, orderBy: { publishedAt: "desc" }, include: { song: true } }),
    prisma.releaseCampaign.count({ where: { status: { in: [ReleaseCampaignStatus.PLANNING, ReleaseCampaignStatus.ACTIVE] } } }),
    prisma.releaseCampaign.findMany({
      take: 4,
      where: { status: { in: [ReleaseCampaignStatus.PLANNING, ReleaseCampaignStatus.ACTIVE] } },
      orderBy: { updatedAt: "desc" },
      include: { items: true, scheduledReleases: true }
    }),
    prisma.scheduledRelease.findMany({
      take: 7,
      where: { scheduledFor: { gte: now }, status: { in: [ScheduledReleaseStatus.PLANNED, ScheduledReleaseStatus.SCHEDULED] } },
      orderBy: { scheduledFor: "asc" },
      include: { song: true, playlist: true, campaign: true }
    }),
    prisma.scheduledRelease.findMany({
      take: 6,
      where: { scheduledFor: { lt: now }, status: { notIn: [ScheduledReleaseStatus.PUBLISHED, ScheduledReleaseStatus.CANCELED, ScheduledReleaseStatus.SKIPPED] } },
      orderBy: { scheduledFor: "asc" },
      include: { song: true, playlist: true, campaign: true }
    }),
    prisma.analyticsSnapshot.findMany({ take: 5, orderBy: { snapshotDate: "desc" }, include: { song: true } }),
    prisma.userPreference.findUnique({ where: { key: "dashboard" } })
  ]);

  const preferences = resolveDashboardPreferences(preference?.value, config.dashboardDefaultPreset);
  const compact = preferences.compact;
  const reports = allSongs.map((song) => ({ song, readiness: songReadiness(song) }));
  const queue = buildReleaseQueue(allSongs);
  const integrations = integrationStatuses();
  const totalSongs = allSongs.length;
  const drafts = allSongs.filter((song) => song.status === SongStatus.DRAFT).length;
  const ready = allSongs.filter((song) => song.status === SongStatus.READY).length;
  const published = allSongs.filter((song) => song.status === SongStatus.PUBLISHED).length;
  const scheduledThisWeek = upcomingReleases.length;
  const missingCover = reports.filter((item) => !item.readiness.hasCoverArt).length;
  const missingFullAudio = reports.filter((item) => !item.readiness.hasFullAudio).length;
  const missingShortAudio = reports.filter((item) => !item.readiness.hasShortAudio).length;
  const readyShorts = reports.filter((item) => item.readiness.readyForShorts).length;
  const readyFull = reports.filter((item) => item.readiness.readyForYoutubePublish).length;
  const noCampaign = allSongs.filter((song) => !song.campaignItems.length).length;
  const noSchedule = allSongs.filter((song) => !song.scheduledReleases.length).length;
  const performanceSummary = summarizeAnalytics(recentAnalytics);

  const statBands = [
    { label: "Ready now", value: queue.readyNow.length, icon: Radio },
    { label: "Nearly ready", value: queue.nearlyReady.length, icon: Sparkles },
    { label: "Scheduled this week", value: scheduledThisWeek, icon: CalendarDays },
    { label: "Overdue", value: overdueReleases.length, icon: FileWarning },
    { label: "Active campaigns", value: activeCampaigns, icon: Flag },
    { label: "Total songs", value: totalSongs, icon: Music2 },
    { label: "Drafts", value: drafts, icon: Sparkles },
    { label: "Ready", value: ready, icon: Radio },
    { label: "Published", value: published, icon: ArrowRight },
    { label: "Missing cover", value: missingCover, icon: FileWarning },
    { label: "Missing full audio", value: missingFullAudio, icon: FileAudio },
    { label: "Missing short audio", value: missingShortAudio, icon: FileAudio },
    { label: "Ready for shorts", value: readyShorts, icon: Radio },
    { label: "Ready for full publish", value: readyFull, icon: ArrowRight },
    { label: "No campaign", value: noCampaign, icon: Flag },
    { label: "No schedule", value: noSchedule, icon: CalendarDays },
    { label: "Playlists", value: playlistsCount, icon: ListPlus }
  ];

  const visibleStats = preferences.preset === "minimal" ? statBands.slice(0, 4) : compact ? statBands.slice(0, 8) : statBands;

  return (
    <>
      <PageHeading title="Dashboard" subtitle="A quieter release desk for songs, campaigns, syncs, and next moves." />
      <div className="mb-6 grid gap-4 xl:grid-cols-[1fr_320px]">
        <DashboardCustomizer initial={preferences} />
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-white">Current mode</p>
          <p className="mt-1 text-sm text-mist/65">{preferences.preset} preset · {compact ? "compact" : "comfortable"} density</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {integrations.map((integration) => (
              <span key={integration.id} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-mist/75 ring-1 ring-white/10">
                {integration.label}: {integration.mode}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={compact ? "space-y-4" : "space-y-6"}>
        {dashboardSectionEnabled(preferences, "stats") ? (
          <section className={compact ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"}>
            {visibleStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-mist/60">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose/12 text-rose ring-1 ring-rose/20">
                    <stat.icon size={18} />
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <div className={compact ? "grid gap-4 xl:grid-cols-2" : "grid gap-6 xl:grid-cols-2"}>
          {dashboardSectionEnabled(preferences, "quick-actions") ? (
            <DashboardSectionCard title="Quick Actions" eyebrow="next move" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "quick-actions")}>
              <div className="grid gap-2">
                {[
                  ["/songs/new", "New Song"],
                  ["/playlists", "New Playlist"],
                  ["/campaigns/new", "New Campaign"],
                  ["/calendar", "Schedule Release"],
                  ["/queue", "Release Queue"],
                  ["/integrations", "Integrations"]
                ].map(([href, label]) => (
                  <Link key={label} href={href} className="flex items-center justify-between rounded-lg bg-white/7 px-4 py-3 text-sm text-mist hover:bg-white/12">
                    {label}
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            </DashboardSectionCard>
          ) : null}

          {dashboardSectionEnabled(preferences, "queue") ? (
            <DashboardSectionCard title="Next Best Moves" eyebrow="release queue" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "queue")}>
              <QueuePreview items={queue.items.slice(0, compact ? 4 : 6)} />
            </DashboardSectionCard>
          ) : null}
        </div>

        <div className={compact ? "grid gap-4 xl:grid-cols-2" : "grid gap-6 xl:grid-cols-2"}>
          {dashboardSectionEnabled(preferences, "upcoming") ? (
            <DashboardSectionCard title="Upcoming Releases" eyebrow="next 7" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "upcoming")}>
              <ReleasePreview releases={upcomingReleases} />
              {overdueReleases.length ? (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-100 ring-1 ring-red-300/15">
                  {overdueReleases.length} overdue planned release{overdueReleases.length === 1 ? "" : "s"} waiting for a decision.
                </div>
              ) : null}
            </DashboardSectionCard>
          ) : null}

          {dashboardSectionEnabled(preferences, "campaigns") ? (
            <DashboardSectionCard title="Campaign Summary" eyebrow={`${activeCampaigns} active`} compact={compact} collapsed={dashboardSectionCollapsed(preferences, "campaigns")}>
              {campaignPreview.length ? (
                <div className="space-y-3">
                  {campaignPreview.map((campaign) => (
                    <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-lg bg-white/5 px-4 py-3 hover:bg-white/8">
                      <p className="font-medium text-white">{campaign.title}</p>
                      <p className="text-sm text-mist/55">{campaign.goal.replaceAll("_", " ")} · {campaign.items.length} items · {campaign.scheduledReleases.length} releases</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No active campaigns yet.</p>
              )}
            </DashboardSectionCard>
          ) : null}
        </div>

        <div className={compact ? "grid gap-4 xl:grid-cols-2" : "grid gap-6 xl:grid-cols-2"}>
          {dashboardSectionEnabled(preferences, "recent-songs") ? (
            <DashboardSectionCard title="Recent Songs" eyebrow="fresh ink" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "recent-songs")}>
              <SongList songs={recentSongs} />
            </DashboardSectionCard>
          ) : null}

          {dashboardSectionEnabled(preferences, "recent-updated") ? (
            <DashboardSectionCard title="Recently Updated" eyebrow="still breathing" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "recent-updated")}>
              <SongList songs={recentUpdated} />
            </DashboardSectionCard>
          ) : null}
        </div>

        <div className={compact ? "grid gap-4 xl:grid-cols-2" : "grid gap-6 xl:grid-cols-2"}>
          {dashboardSectionEnabled(preferences, "recent-activity") ? (
            <DashboardSectionCard title="Recent Activity" eyebrow="publishes and uploads" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "recent-activity")}>
              <div className="grid gap-4 md:grid-cols-2">
                <ActivityList
                  title="Recent Uploads"
                  items={recentAssets.map((asset) => ({
                    href: asset.songId ? `/songs/${asset.songId}` : "/songs",
                    title: asset.title,
                    meta: `${asset.type.replaceAll("_", " ")} · ${asset.song?.title || "Unassigned"}`
                  }))}
                />
                <ActivityList
                  title="Recently Published"
                  items={recentPublishes.map((event) => ({
                    href: `/songs/${event.songId}`,
                    title: event.song.title,
                    meta: `${event.platform} · ${event.contentType.replaceAll("_", " ")} · ${dateLabel(event.publishedAt)}`
                  }))}
                />
              </div>
            </DashboardSectionCard>
          ) : null}

          {dashboardSectionEnabled(preferences, "needs-attention") ? (
            <DashboardSectionCard title="Needs Attention" eyebrow="quiet blockers" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "needs-attention")}>
              <div className="space-y-3">
                <AttentionGroup title="Missing cover art" songs={reports.filter((item) => !item.readiness.hasCoverArt).map((item) => item.song).slice(0, compact ? 3 : 5)} />
                <AttentionGroup title="Missing full audio" songs={reports.filter((item) => !item.readiness.hasFullAudio).map((item) => item.song).slice(0, compact ? 3 : 5)} />
                <AttentionGroup title="Missing short audio" songs={reports.filter((item) => !item.readiness.hasShortAudio).map((item) => item.song).slice(0, compact ? 3 : 5)} />
                <AttentionGroup title="Publish-ready but unscheduled" songs={queue.items.filter((item) => (item.recommendation.signals.readyForYoutube || item.recommendation.signals.readyForShorts) && item.recommendation.signals.hasNoSchedule).map((item) => item.song).slice(0, compact ? 3 : 5)} />
              </div>
            </DashboardSectionCard>
          ) : null}
        </div>

        {dashboardSectionEnabled(preferences, "performance") ? (
          <DashboardSectionCard title="Recent Performance" eyebrow="latest snapshots" compact={compact} collapsed={dashboardSectionCollapsed(preferences, "performance")}>
            {performanceSummary ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-sm text-mist/60">Latest rollup</p>
                  <p className="mt-1 text-lg font-semibold text-white">{performanceSummary.platform}</p>
                  <p className="mt-2 text-sm text-mist/70">Views {formatMetric(performanceSummary.views)} · Likes {formatMetric(performanceSummary.likes)} · Comments {formatMetric(performanceSummary.comments)}</p>
                </div>
                <div className="space-y-2">
                  {recentAnalytics.map((snapshot) => (
                    <Link key={snapshot.id} href={snapshot.songId ? `/songs/${snapshot.songId}` : "/songs"} className="block rounded-lg bg-white/5 px-4 py-3 hover:bg-white/8">
                      <p className="font-medium text-white">{snapshot.song?.title || "Standalone metric"}</p>
                      <p className="text-sm text-mist/55">{snapshot.platform} · {formatMetric(snapshot.views)} views · {dateLabel(snapshot.snapshotDate)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No analytics snapshots yet. Add a manual snapshot on a song page when numbers start whispering back.</p>
            )}
          </DashboardSectionCard>
        ) : null}
      </div>
    </>
  );
}

type DashboardSong = Awaited<ReturnType<typeof prisma.song.findMany>>[number] & { tags?: { name: string }[] };
type DashboardRelease = Awaited<ReturnType<typeof prisma.scheduledRelease.findMany>>[number] & {
  song?: { id: string; title: string } | null;
  playlist?: { id: string; title: string } | null;
  campaign?: { id: string; title: string } | null;
};

function SongList({ songs }: { songs: DashboardSong[] }) {
  if (!songs.length) return <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No songs here yet.</p>;
  return (
    <div className="divide-y divide-white/10">
      {songs.map((song) => (
        <Link key={song.id} href={`/songs/${song.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-medium text-white">{song.title}</p>
            <p className="text-sm text-mist/55">{song.theme || "No theme"} · {dateLabel(song.updatedAt)}</p>
          </div>
          <StatusBadge status={song.status} />
        </Link>
      ))}
    </div>
  );
}

function ActivityList({ title, items }: { title: string; items: Array<{ href: string; title: string; meta: string }> }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="mb-2 text-sm font-semibold text-white">{title}</p>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Link key={`${item.href}-${item.title}-${item.meta}`} href={item.href} className="block">
              <p className="text-sm text-mist hover:text-rose">{item.title}</p>
              <p className="text-xs text-mist/45">{item.meta}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mist/50">No activity yet.</p>
      )}
    </div>
  );
}

function AttentionGroup({ title, songs }: { title: string; songs: DashboardSong[] }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="mb-2 text-sm font-semibold text-white">{title}</p>
      {songs.length ? songs.map((song) => (
        <Link key={song.id} href={`/songs/${song.id}`} className="block py-1 text-sm text-mist/70 hover:text-rose">
          {song.title}
        </Link>
      )) : <p className="text-sm text-mist/50">Nothing stacked here.</p>}
    </div>
  );
}

type QueuePreviewItem = ReturnType<typeof buildReleaseQueue>["items"][number];

function QueuePreview({ items }: { items: QueuePreviewItem[] }) {
  if (!items.length) return <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No queue signals yet.</p>;
  return (
    <div className="divide-y divide-white/10">
      {items.map(({ song, recommendation }) => (
        <Link key={song.id} href={`/songs/${song.id}`} className="block py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">{song.title}</p>
              <p className="text-sm text-mist/55">{recommendation.label} · score {recommendation.score}</p>
            </div>
            <ArrowRight size={16} className="text-rose" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function ReleasePreview({ releases }: { releases: DashboardRelease[] }) {
  if (!releases.length) return <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">The next week is still open.</p>;
  return (
    <div className="divide-y divide-white/10">
      {releases.map((release) => {
        const href = release.songId ? `/songs/${release.songId}` : release.playlistId ? `/playlists/${release.playlistId}` : release.campaignId ? `/campaigns/${release.campaignId}` : "/calendar";
        const related = release.song?.title || release.playlist?.title || release.campaign?.title || "Standalone release";
        return (
          <Link key={release.id} href={href} className="block py-3">
            <p className="font-medium text-white">{release.title}</p>
            <p className="text-sm text-mist/55">{related} · {release.platform} · {release.scheduledFor ? dateLabel(release.scheduledFor) : "unscheduled"}</p>
          </Link>
        );
      })}
    </div>
  );
}
