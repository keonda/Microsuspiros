import Link from "next/link";
import { ArrowRight, FileWarning, ListPlus, Music2, Radio, Sparkles } from "lucide-react";
import { SongStatus } from "@prisma/client";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalSongs, drafts, ready, published, missingCover, missingShort, playlistsCount, recentSongs, recentUpdated] = await Promise.all([
    prisma.song.count(),
    prisma.song.count({ where: { status: SongStatus.DRAFT } }),
    prisma.song.count({ where: { status: SongStatus.READY } }),
    prisma.song.count({ where: { status: SongStatus.PUBLISHED } }),
    prisma.song.count({ where: { hasCoverArt: false } }),
    prisma.song.count({ where: { hasShortVersion: false } }),
    prisma.playlist.count(),
    prisma.song.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { tags: true } }),
    prisma.song.findMany({ take: 5, orderBy: { updatedAt: "desc" }, include: { tags: true } })
  ]);

  const stats = [
    { label: "Total songs", value: totalSongs, icon: Music2 },
    { label: "Drafts", value: drafts, icon: Sparkles },
    { label: "Ready", value: ready, icon: Radio },
    { label: "Published", value: published, icon: ArrowRight },
    { label: "Missing cover", value: missingCover, icon: FileWarning },
    { label: "Missing short", value: missingShort, icon: FileWarning },
    { label: "Playlists", value: playlistsCount, icon: ListPlus }
  ];

  return (
    <>
      <PageHeading title="Dashboard" subtitle="A quiet command center for songs, shorts, playlists, and publishing readiness." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-mist/60">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-rose/12 text-rose ring-1 ring-rose/20">
                <stat.icon size={20} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardTitle title="Recent Songs" eyebrow="Fresh ink" />
          <SongList songs={recentSongs} />
        </Card>
        <Card>
          <CardTitle title="Quick Actions" eyebrow="Next move" />
          <div className="grid gap-3">
            {[
              ["/songs/new", "New Song"],
              ["/playlists", "New Playlist"],
              ["/songs?status=DRAFT", "View Drafts"],
              ["/workflow", "Missing Assets"],
              ["/songs?status=READY", "Ready to Publish"]
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded-lg bg-white/7 px-4 py-3 text-sm text-mist hover:bg-white/12">
                {label}
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle title="Recently Updated" eyebrow="Still breathing" />
        <SongList songs={recentUpdated} />
      </Card>
    </>
  );
}

type DashboardSong = Awaited<ReturnType<typeof prisma.song.findMany>>[number] & { tags?: { name: string }[] };

function SongList({ songs }: { songs: DashboardSong[] }) {
  if (!songs.length) return <p className="rounded-lg bg-white/5 p-4 text-sm text-mist/65">No songs yet. Start with the first small breath.</p>;
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
