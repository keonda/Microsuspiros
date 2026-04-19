import Link from "next/link";
import { SongStatus } from "@prisma/client";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const [noCover, noShort, notYoutube, ready] = await Promise.all([
    prisma.song.findMany({ where: { hasCoverArt: false }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.song.findMany({ where: { hasShortVersion: false }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.song.findMany({ where: { publishedYoutube: false }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.song.findMany({ where: { status: SongStatus.READY }, orderBy: { updatedAt: "desc" }, take: 12 })
  ]);

  return (
    <>
      <PageHeading title="Workflow" subtitle="Publishing readiness, missing pieces, and the songs closest to release." />
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkflowCard title="Missing Cover Art" songs={noCover} empty="Every song in this view has cover art." />
        <WorkflowCard title="Missing Short Version" songs={noShort} empty="All songs have suspiro versions." />
        <WorkflowCard title="Not On YouTube" songs={notYoutube} empty="Everything here has reached YouTube." />
        <WorkflowCard title="Ready To Publish" songs={ready} empty="No songs are marked ready yet." />
      </div>
    </>
  );
}

type WorkflowSong = Awaited<ReturnType<typeof prisma.song.findMany>>[number];

function WorkflowCard({ title, songs, empty }: { title: string; songs: WorkflowSong[]; empty: string }) {
  return (
    <Card>
      <CardTitle title={title} />
      {songs.length ? (
        <div className="divide-y divide-white/10">
          {songs.map((song) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-white">{song.title}</p>
                <p className="text-sm text-mist/55">{song.mood || "No mood"} · {song.theme || "No theme"}</p>
              </div>
              <StatusBadge status={song.status} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">{empty}</p>
      )}
    </Card>
  );
}
