import { notFound } from "next/navigation";
import { AssetType, PlaylistType } from "@prisma/client";
import { addSongToPlaylist, deletePlaylist, removeSongFromPlaylist, updatePlaylist, updatePlaylistOrder } from "@/actions/playlist-actions";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PlaylistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [playlist, songs] = await Promise.all([
    prisma.playlist.findUnique({
      where: { id },
      include: { playlistSongs: { include: { song: { include: { assets: true } } }, orderBy: { position: "asc" } } }
    }),
    prisma.song.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } })
  ]);
  if (!playlist) notFound();

  const inPlaylist = new Set(playlist.playlistSongs.map((item) => item.songId));
  const availableSongs = songs.filter((song) => !inPlaylist.has(song.id));
  const coverCount = playlist.playlistSongs.filter((item) => item.song.assets.some((asset) => asset.type === AssetType.COVER_ART)).length;
  const fullAudioCount = playlist.playlistSongs.filter((item) => item.song.assets.some((asset) => asset.type === AssetType.AUDIO_FULL)).length;
  const shortAudioCount = playlist.playlistSongs.filter((item) => item.song.assets.some((asset) => asset.type === AssetType.AUDIO_SHORT)).length;

  return (
    <>
      <PageHeading title={playlist.title} subtitle={`/${playlist.slug}`} />
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle title="Playlist Details" />
            <form action={updatePlaylist.bind(null, playlist.id)} className="space-y-4">
              <input name="title" required defaultValue={playlist.title} className={inputClass()} />
              <select name="type" defaultValue={playlist.type} className={inputClass()}>
                {Object.values(PlaylistType).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </select>
              <textarea name="description" defaultValue={playlist.description ?? ""} rows={5} className={inputClass()} />
              <Button type="submit">Save playlist</Button>
            </form>
          </Card>
          <Card>
            <CardTitle title="Asset Summary" />
            <div className="grid gap-2 text-sm text-mist/70">
              <p>Cover art: {coverCount}/{playlist.playlistSongs.length}</p>
              <p>Full audio: {fullAudioCount}/{playlist.playlistSongs.length}</p>
              <p>Short audio: {shortAudioCount}/{playlist.playlistSongs.length}</p>
            </div>
          </Card>
          <Card>
            <CardTitle title="Add Song" />
            <form action={addSongToPlaylist.bind(null, playlist.id)} className="space-y-3">
              <select name="songId" className={inputClass()} defaultValue="">
                <option value="" disabled>Choose a song</option>
                {availableSongs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
              </select>
              <Button type="submit" variant="secondary">Add to playlist</Button>
            </form>
          </Card>
          <Card>
            <form action={deletePlaylist.bind(null, playlist.id)}>
              <Button type="submit" variant="danger" className="w-full">Delete playlist</Button>
            </form>
          </Card>
        </div>
        <Card>
          <CardTitle title="Ordered Songs" eyebrow={`${playlist.playlistSongs.length} songs`} />
          {playlist.playlistSongs.length ? (
            <form action={updatePlaylistOrder.bind(null, playlist.id)}>
              <div className="space-y-3">
                {playlist.playlistSongs.map((item) => (
                  <div key={item.songId} className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[90px_1fr_auto] md:items-center">
                    <input
                      name={`position:${item.songId}`}
                      type="number"
                      min="0"
                      defaultValue={item.position}
                      className={inputClass("md:max-w-[80px]")}
                    />
                    <div>
                      <p className="font-medium text-white">{item.song.title}</p>
                      <div className="mt-2"><StatusBadge status={item.song.status} /></div>
                    </div>
                    <Button type="submit" variant="danger" formAction={removeSongFromPlaylist.bind(null, playlist.id, item.songId)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="submit" className="mt-4">Save order</Button>
            </form>
          ) : (
            <p className="rounded-lg bg-white/5 p-5 text-sm text-mist/65">This playlist is still empty.</p>
          )}
        </Card>
      </div>
    </>
  );
}
