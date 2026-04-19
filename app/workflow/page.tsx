import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge, Pill } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const songs = await prisma.song.findMany({ orderBy: { updatedAt: "desc" }, take: 80 });
  const reports = songs.map((song) => ({ song, readiness: songReadiness(song) }));

  return (
    <>
      <PageHeading title="Workflow" subtitle="Publishing readiness, missing pieces, and the songs closest to release." />
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowCard title="Missing Lyrics" items={reports.filter((item) => !item.readiness.hasLyrics)} empty="Every song has lyrics or a full version." />
        <WorkflowCard title="Missing Short Version" items={reports.filter((item) => !item.readiness.hasShortVersion)} empty="All songs have suspiro versions." />
        <WorkflowCard title="Missing YouTube Metadata" items={reports.filter((item) => !item.readiness.hasYoutubeTitle || !item.readiness.hasYoutubeDescription)} empty="All songs have YouTube metadata." />
        <WorkflowCard title="Missing Website Excerpt" items={reports.filter((item) => !item.readiness.hasExcerpt)} empty="All songs have website excerpts." />
        <WorkflowCard title="Missing Cover Art" items={reports.filter((item) => !item.readiness.hasCoverArt)} empty="Every song in this view has cover art." />
        <WorkflowCard title="Ready For YouTube" items={reports.filter((item) => item.readiness.readyForYoutube)} empty="No songs are ready for YouTube yet." />
        <WorkflowCard title="Ready For Website" items={reports.filter((item) => item.readiness.readyForWebsite)} empty="No songs are ready for the website yet." />
        <WorkflowCard title="Fully Publishable" items={reports.filter((item) => item.readiness.fullyPublishable)} empty="No songs are fully publishable yet." />
      </div>
    </>
  );
}

type WorkflowItem = {
  song: Awaited<ReturnType<typeof prisma.song.findMany>>[number];
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
                <div className="mt-2 flex flex-wrap gap-1.5">{readiness.missing.slice(0, 4).map((item) => <Pill key={item}>{item}</Pill>)}</div>
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
