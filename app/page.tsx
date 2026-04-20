import Link from "next/link";
import { ArrowRight, FileAudio, FileWarning, ListPlus, Music2, Radio, Sparkles } from "lucide-react";
import { AssetType, SongStatus } from "@prisma/client";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { songReadiness } from "@/lib/song-readiness";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allSongs, drafts, ready, published, playlistsCount, recentSongs, recentUpdated, aiDrafts, recentAssets, recentPublishes] = await Promise.all([
    prisma.song.findMany({ include: { assets: true, publishEvents: true } }),
    prisma.song.count({ where: { status: SongStatus.DRAFT } }),
    prisma.song.count({ where: { status: SongStatus.READY } }),
    prisma.song.count({ where: { status: SongStatus.PUBLISHED } }),
    prisma.playlist.count(),
    prisma.song.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { tags: true } }),
    prisma.song.findMany({ take: 5, orderBy: { updatedAt: "desc" }, include: { tags: true } }),
    prisma.aIGenerationLog.count(),
    prisma.asset.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { song: true } }),
    prisma.publishEvent.findMany({ take: 5, orderBy: { publishedAt: "desc" }, include: { song: true } })
  ]);
  const reports = allSongs.map((song) => ({ song, readiness: songReadiness(song) }));
  const totalSongs = allSongs.length;
  const missingCover = reports.filter((item) => !item.readiness.hasCoverArt).length;
  const missingFullAudio = reports.filter((item) => !item.readiness.hasFullAudio).length;
  const missingShortAudio = reports.filter((item) => !item.readiness.hasShortAudio).length;
  const readyShorts = reports.filter((item) => item.readiness.readyForShorts).length;
  const readyFull = reports.filter((item) => item.readiness.readyForYoutubePublish).length;
  const fullyPublishable = reports.filter((item) => item.readiness.fullyPublishable).length;
  const staleNoPublish = allSongs.filter((song) => !song.publishEvents.length).slice(0, 5);

  const stats = [
    { label: "Total songs", value: totalSongs, icon: Music2 },
    { label: "Drafts", value: drafts, icon: Sparkles },
    { label: "Ready", value: ready, icon: Radio },
    { label: "Published", value: published, icon: ArrowRight },
    { label: "Missing cover", value: missingCover, icon: FileWarning },
    { label: "Missing full audio", value: missingFullAudio, icon: FileAudio },
    { label: "Missing short audio", value: missingShortAudio, icon: FileAudio },
    { label: "Ready for shorts", value: readyShorts, icon: Radio },
    { label: "Ready for full publish", value: readyFull, icon: ArrowRight },
    { label: "Fully publishable", value: fullyPublishable, icon: Sparkles },
    { label: "AI drafts", value: aiDrafts, icon: Sparkles },
    { label: "Playlists", value: playlistsCount, icon: ListPlus }
  ];

  return (
    <>
      <PageHeading title="Dashboard" subtitle="A quiet command center for songs, assets, publishing, and readiness." />
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
              ["/workflow", "Missing Assets"],
              ["/workflow", "Ready to Publish"]
            ].map(([href, label]) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded-lg bg-white/7 px-4 py-3 text-sm text-mist hover:bg-white/12">
                {label}
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle title="Recent Activity" eyebrow="uploads and publishes" />
        <div className="grid gap-4 md:grid-cols-2">
          <ActivityList
            title="Recent Uploads"
            items={recentAssets.map((asset) => ({
              href: asset.songId ? `/songs/${asset.songId}` : "/songs",
              title: asset.title,
              meta: `${asset.type.replaceAll("_", " ")} - ${asset.song?.title || "Unassigned"}`
            }))}
          />
          <ActivityList
            title="Recently Published"
            items={recentPublishes.map((event) => ({
              href: `/songs/${event.songId}`,
              title: event.song.title,
              meta: `${event.platform} - ${event.contentType.replaceAll("_", " ")} - ${dateLabel(event.publishedAt)}`
            }))}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <CardTitle title="Recently Updated" eyebrow="Still breathing" />
        <SongList songs={recentUpdated} />
      </Card>

      <Card className="mt-6">
        <CardTitle title="Needs Attention" eyebrow="quiet blockers" />
        <div className="grid gap-4 md:grid-cols-4">
          <AttentionList title="Missing Cover Art" songs={reports.filter((item) => !item.readiness.hasCoverArt).map((item) => item.song).slice(0, 5)} />
          <AttentionList title="Missing Full Audio" songs={reports.filter((item) => !item.song.assets.some((asset) => asset.type === AssetType.AUDIO_FULL)).map((item) => item.song).slice(0, 5)} />
          <AttentionList title="Missing Short Audio" songs={reports.filter((item) => !item.song.assets.some((asset) => asset.type === AssetType.AUDIO_SHORT)).map((item) => item.song).slice(0, 5)} />
          <AttentionList title="No Publish Event" songs={staleNoPublish} />
        </div>
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
            <p className="text-sm text-mist/55">{song.theme || "No theme"} - {dateLabel(song.updatedAt)}</p>
          </div>
          <StatusBadge status={song.status} />
        </Link>
      ))}
    </div>
  );
}

function AttentionList({ title, songs }: { title: string; songs: DashboardSong[] }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="mb-2 text-sm font-semibold text-white">{title}</p>
      {songs.length ? (
        <div className="space-y-2">
          {songs.map((song) => (
            <Link key={song.id} href={`/songs/${song.id}`} className="block text-sm text-mist/70 hover:text-rose">
              {song.title}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mist/50">Nothing waiting here.</p>
      )}
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
