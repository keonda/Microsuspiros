"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { formString, playlistSchema } from "@/lib/validation";

function playlistInput(formData: FormData) {
  return playlistSchema.parse({
    title: formString(formData, "title"),
    type: formString(formData, "type"),
    description: formString(formData, "description")
  });
}

export async function createPlaylist(formData: FormData) {
  const input = playlistInput(formData);
  const slug = await uniqueSlug(input.title, async (candidate) => Boolean(await prisma.playlist.findUnique({ where: { slug: candidate } })));
  const playlist = await prisma.playlist.create({ data: { ...input, slug } });
  revalidatePath("/playlists");
  redirect(`/playlists/${playlist.id}`);
}

export async function updatePlaylist(id: string, formData: FormData) {
  const input = playlistInput(formData);
  await prisma.playlist.update({ where: { id }, data: input });
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${id}`);
  redirect(`/playlists/${id}`);
}

export async function deletePlaylist(id: string) {
  await prisma.playlist.delete({ where: { id } });
  revalidatePath("/playlists");
  redirect("/playlists");
}

export async function addSongToPlaylist(playlistId: string, formData: FormData) {
  const songId = formString(formData, "songId");
  if (!songId) return;
  const count = await prisma.playlistSong.count({ where: { playlistId } });
  await prisma.playlistSong.upsert({
    where: { playlistId_songId: { playlistId, songId } },
    update: {},
    create: { playlistId, songId, position: count + 1 }
  });
  revalidatePath(`/playlists/${playlistId}`);
}

export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  await prisma.playlistSong.delete({ where: { playlistId_songId: { playlistId, songId } } });
  revalidatePath(`/playlists/${playlistId}`);
}

export async function updatePlaylistOrder(playlistId: string, formData: FormData) {
  const updates = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("position:"))
    .map(([key, value]) => ({
      songId: key.replace("position:", ""),
      position: Number(value) || 0
    }));

  await prisma.$transaction(
    updates.map((item) =>
      prisma.playlistSong.update({
        where: { playlistId_songId: { playlistId, songId: item.songId } },
        data: { position: item.position }
      })
    )
  );
  revalidatePath(`/playlists/${playlistId}`);
}
