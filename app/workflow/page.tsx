import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";
import { dateLabel } from "@/lib/format";
import type { Asset, PublishEvent, Song } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const [songs, recentPublishes] = await Promise.all([
    prisma.song.findMany({ orderBy: { updatedAt: "desc" }, take: 100, include: { assets: true, publishEvents: true } }),
    prisma.publishEvent.findMany({ orderBy: { publishedAt: "desc" }, take: 12, include: { song: true } })
  ]);
  const reports = songs.map((song) => ({ song, readiness: songReadiness(song) }));

  return (
    <>
      <PageHeading title="Workflow" subtitle="Operational checklists for assets, shorts, publishing, and songs that need attention." />
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowCard title="Missing Cover Art" items={reports.filter((item) => !item.readiness.hasCoverArt)} empty="Every song in this view has cover art." />
        <WorkflowCard title="Missing Full Audio" items={reports.filter((item) => !item.readiness.hasFullAudio)} empty="Every song has full audio." />
        <WorkflowCard title="Missing Short Audio" items={reports.filter((item) => !item.readiness.hasShortAudio)} empty="Every song has short audio." />
        <WorkflowCard title="Missing Metadata" items={reports.filter((item) => !item.readiness.hasYoutubeMetadata || !item.readiness.hasExcerpt)} empty="All songs have publishing metadata." />
        <WorkflowCard title="Ready For Shorts" items={reports.filter((item) => item.readiness.readyForShorts)} empty="No songs are ready for shorts yet." />
        <WorkflowCard title="Ready For YouTube" items={reports.filter((item) => item.readiness.readyForYoutubePublish)} empty="No songs are ready for YouTube yet." />
        <WorkflowCard title="Ready For Website" items={reports.filter((item) => item.readiness.readyForWebsitePublish)} empty="No songs are ready for the website yet." />
        <RecentPublishCard events={recentPublishes} />
      </div>
    </>
  );
}

type WorkflowItem = {
  song: Song & { assets: Asset[]; publishEvents: PublishEvent[] };
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
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">{empty}</p>
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
