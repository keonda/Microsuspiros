import Link from "next/link";
import { PlaylistType } from "@prisma/client";
import { createPlaylist } from "@/actions/playlist-actions";
import { PageHeading } from "@/components/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const playlists = await prisma.playlist.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { playlistSongs: true } } }
  });

  return (
    <>
      <PageHeading title="Playlists" subtitle="Build collections for shorts, moods, compilations, and creator-ready sets." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardTitle title="Collections" />
          {playlists.length ? (
            <div className="grid gap-3">
              {playlists.map((playlist) => (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`} className="rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/9">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{playlist.title}</p>
                      <p className="mt-1 text-sm text-mist/55">{playlist.description || "No description yet."}</p>
                    </div>
                    <div className="text-right text-sm text-mist/60">
                      <p>{playlist._count.playlistSongs} songs</p>
                      <p>{playlist.type.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-mist/45">Updated {dateLabel(playlist.updatedAt)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-white/5 p-5 text-sm text-mist/65">No playlists yet. Create one for a mood, a short set, or a quiet season.</p>
          )}
        </Card>
        <Card>
          <CardTitle title="New Playlist" />
          <form action={createPlaylist} className="space-y-4">
            <input name="title" required className={inputClass()} placeholder="Cartas que no envie" />
            <select name="type" className={inputClass()} defaultValue="CUSTOM">
              {Object.values(PlaylistType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
            </select>
            <textarea name="description" rows={5} className={inputClass()} placeholder="A collection for late-night shorts..." />
            <Button type="submit">Create playlist</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
