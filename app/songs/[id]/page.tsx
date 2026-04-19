import { notFound } from "next/navigation";
import { deleteSong, duplicateSong, generateMetadata, markSongReady, updateSong } from "@/actions/song-actions";
import { PageHeading } from "@/components/page-heading";
import { SongForm } from "@/components/song-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [song, playlists, logs] = await Promise.all([
    prisma.song.findUnique({ where: { id }, include: { tags: true, playlistSongs: true } }),
    prisma.playlist.findMany({ orderBy: { title: "asc" } }),
    prisma.aIGenerationLog.findMany({ where: { songId: id }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);
  if (!song) notFound();

  return (
    <>
      <PageHeading title={song.title} subtitle={`Last updated ${dateLabel(song.updatedAt)} · slug ${song.slug}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <SongForm song={song} playlists={playlists} action={updateSong.bind(null, song.id)} submitLabel="Save changes" />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardTitle title="AI Tools" eyebrow="Groq-ready stub" />
            <p className="mb-4 text-sm leading-6 text-mist/65">Generate placeholder metadata now. The abstraction lives in lib/ai.ts so Groq can replace the mock later.</p>
            <form action={generateMetadata.bind(null, song.id)}>
              <Button type="submit" className="w-full">Generate metadata</Button>
            </form>
            <div className="mt-4 space-y-2 text-xs text-mist/55">
              <p>YouTube title: {song.youtubeTitle?.length ?? 0}/100</p>
              <p>Description: {song.youtubeDescription?.length ?? 0} characters</p>
            </div>
          </Card>
          <Card>
            <CardTitle title="Quick Actions" />
            <div className="grid gap-2">
              <form action={markSongReady.bind(null, song.id)}><Button type="submit" variant="secondary" className="w-full">Mark as ready</Button></form>
              <form action={duplicateSong.bind(null, song.id)}><Button type="submit" variant="secondary" className="w-full">Duplicate song</Button></form>
              <form action={deleteSong.bind(null, song.id)}><Button type="submit" variant="danger" className="w-full">Delete song</Button></form>
            </div>
          </Card>
          <Card>
            <CardTitle title="AI History" />
            {logs.length ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs font-semibold text-gold">{log.kind.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-mist/55">{dateLabel(log.createdAt)}</p>
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
