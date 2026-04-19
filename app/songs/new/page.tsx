import { createSong } from "@/actions/song-actions";
import { PageHeading } from "@/components/page-heading";
import { SongForm } from "@/components/song-form";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewSongPage() {
  const playlists = await prisma.playlist.findMany({ orderBy: { title: "asc" } });
  return (
    <>
      <PageHeading title="New Song" subtitle="Capture the long version, the suspiro, and the first publishing hints in one place." />
      <Card>
        <SongForm playlists={playlists} action={createSong} submitLabel="Create song" />
      </Card>
    </>
  );
}
