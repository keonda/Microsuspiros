import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { buildReleaseQueue } from "@/lib/release-queue";
import { songReadiness } from "@/lib/song-readiness";
import { dateLabel } from "@/lib/format";
import type { Asset, CampaignItem, PublishEvent, ScheduledRelease, Song } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const now = new Date();
  const [songs, recentPublishes, scheduledReleases] = await Promise.all([
    prisma.song.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { assets: true, publishEvents: true, scheduledReleases: true, campaignItems: true, aiGenerationLogs: true, playlistSongs: true }
    }),
    prisma.publishEvent.findMany({ orderBy: { publishedAt: "desc" }, take: 12, include: { song: true } }),
    prisma.scheduledRelease.findMany({
      where: { scheduledFor: { lt: now }, status: { notIn: ["PUBLISHED", "CANCELED", "SKIPPED"] } },
      orderBy: { scheduledFor: "asc" },
      take: 12,
      include: { song: true, playlist: true, campaign: true }
    })
  ]);
  const reports = songs.map((song) => ({ song, readiness: songReadiness(song) }));
  const queue = buildReleaseQueue(songs);

  return (
    <>
      <PageHeading title="Workflow" subtitle="Operational checklists for readiness, campaigns, scheduling, and songs that need attention." />
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowCard title="Ready To Schedule" items={queue.readyNow.map((item) => ({ song: item.song, readiness: item.recommendation.readiness }))} empty="No songs are fully ready to schedule." />
        <WorkflowCard title="Publish-Ready But Unscheduled" items={queue.items.filter((item) => (item.recommendation.signals.readyForYoutube || item.recommendation.signals.readyForShorts) && item.recommendation.signals.hasNoSchedule).map((item) => ({ song: item.song, readiness: item.recommendation.readiness }))} empty="Ready songs already have release entries." />
        <WorkflowCard title="No Campaign Assigned" items={reports.filter((item) => !item.song.campaignItems.length)} empty="Every song is inside a release arc." />
        <WorkflowCard title="Missing Only One Thing" items={queue.nearlyReady.map((item) => ({ song: item.song, readiness: item.recommendation.readiness }))} empty="No almost-ready songs right now." />
        <WorkflowCard title="Missing Cover Art" items={reports.filter((item) => !item.readiness.hasCoverArt)} empty="Every song in this view has cover art." />
        <WorkflowCard title="Missing Full Audio" items={reports.filter((item) => !item.readiness.hasFullAudio)} empty="Every song has full audio." />
        <WorkflowCard title="Missing Short Audio" items={reports.filter((item) => !item.readiness.hasShortAudio)} empty="Every song has short audio." />
        <WorkflowCard title="Missing Metadata" items={reports.filter((item) => !item.readiness.hasYoutubeMetadata || !item.readiness.hasExcerpt)} empty="All songs have publishing metadata." />
        <WorkflowCard title="Ready For Shorts" items={reports.filter((item) => item.readiness.readyForShorts)} empty="No songs are ready for shorts yet." />
        <WorkflowCard title="Ready For YouTube" items={reports.filter((item) => item.readiness.readyForYoutubePublish)} empty="No songs are ready for YouTube yet." />
        <WorkflowCard title="Ready For Website" items={reports.filter((item) => item.readiness.readyForWebsitePublish)} empty="No songs are ready for the website yet." />
        <OverdueReleaseCard releases={scheduledReleases} />
        <RecentPublishCard events={recentPublishes} />
      </div>
    </>
  );
}

type WorkflowItem = {
  song: Song & { assets: Asset[]; publishEvents: PublishEvent[]; scheduledReleases?: ScheduledRelease[]; campaignItems?: CampaignItem[] };
  readiness: ReturnType<typeof songReadiness>;
};

function WorkflowCard({ title, items, empty }: { title: string; items: WorkflowItem[]; empty: string }) {
  return (
    <Card>
      <CardTitle title={title} eyebrow={`${items.length} songs`} />
      {items.length ? (
        <div className="divide-y divide-white/10">
          {items.slice(0, 12).map(({ song, readiness }) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="block py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{song.title}</p>
                  <p className="text-sm text-mist/55">{song.mood || "No mood"} - {song.theme || "No theme"}</p>
                </div>
                <StatusBadge status={song.status} />
              </div>
              {readiness.missing.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">{readiness.missing.slice(0, 5).map((item) => <Pill key={item}>{item}</Pill>)}</div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/7 px-2.5 py-1 text-mist/60">schedule</span>
                <span className="rounded-full bg-white/7 px-2.5 py-1 text-mist/60">campaign</span>
                <span className="rounded-full bg-white/7 px-2.5 py-1 text-mist/60">open song</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">{empty}</p>
      )}
    </Card>
  );
}

type OverdueRelease = Awaited<ReturnType<typeof prisma.scheduledRelease.findMany>>[number] & {
  song?: Song | null;
  playlist?: { id: string; title: string } | null;
  campaign?: { id: string; title: string } | null;
};

function OverdueReleaseCard({ releases }: { releases: OverdueRelease[] }) {
  return (
    <Card>
      <CardTitle title="Overdue Planned Releases" eyebrow={`${releases.length} items`} />
      {releases.length ? (
        <div className="divide-y divide-white/10">
          {releases.map((release) => {
            const href = release.songId ? `/songs/${release.songId}` : release.playlistId ? `/playlists/${release.playlistId}` : release.campaignId ? `/campaigns/${release.campaignId}` : "/calendar";
            const related = release.song?.title || release.playlist?.title || release.campaign?.title || "Standalone release";
            return (
              <Link key={release.id} href={href} className="block py-3">
                <p className="font-medium text-white">{release.title}</p>
                <p className="text-sm text-mist/55">{related} - {release.platform} - {release.scheduledFor ? dateLabel(release.scheduledFor) : "unscheduled"}</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No overdue releases.</p>
      )}
    </Card>
  );
}

function RecentPublishCard({ events }: { events: Array<PublishEvent & { song: Song }> }) {
  return (
    <Card>
      <CardTitle title="Recently Published" eyebrow={`${events.length} events`} />
      {events.length ? (
        <div className="divide-y divide-white/10">
          {events.map((event) => (
            <Link key={event.id} href={`/songs/${event.songId}`} className="block py-3">
              <p className="font-medium text-white">{event.song.title}</p>
              <p className="text-sm text-mist/55">{event.platform} - {event.contentType.replaceAll("_", " ")} - {dateLabel(event.publishedAt)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No publish events logged yet.</p>
      )}
    </Card>
  );
}
