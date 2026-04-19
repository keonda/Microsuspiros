"use server";

import { AIGenerationKind, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateShortVersion, generateWebsiteExcerpt, generateYoutubeDescription, generateYoutubeTitle } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import { csvTags, formBool, formString, formStringArray, songSchema } from "@/lib/validation";

function songInput(formData: FormData) {
  return songSchema.parse({
    title: formString(formData, "title"),
    status: formString(formData, "status"),
    mood: formString(formData, "mood"),
    theme: formString(formData, "theme"),
    language: formString(formData, "language") || "Spanish",
    fullLyrics: formString(formData, "fullLyrics"),
    shortVersion: formString(formData, "shortVersion"),
    hookText: formString(formData, "hookText"),
    youtubeTitle: formString(formData, "youtubeTitle"),
    youtubeDescription: formString(formData, "youtubeDescription"),
    websiteExcerpt: formString(formData, "websiteExcerpt"),
    notes: formString(formData, "notes"),
    hasCoverArt: formBool(formData, "hasCoverArt"),
    hasFullVersion: formBool(formData, "hasFullVersion"),
    hasShortVersion: formBool(formData, "hasShortVersion"),
    publishedYoutube: formBool(formData, "publishedYoutube"),
    publishedWebsite: formBool(formData, "publishedWebsite"),
    tags: csvTags(formString(formData, "tags")),
    playlistIds: formStringArray(formData, "playlistIds")
  });
}

async function tagConnections(names: string[]) {
  return names.map((name) => ({
    where: { slug: slugify(name) },
    create: { name, slug: slugify(name) }
  }));
}

export async function createSong(formData: FormData) {
  const input = songInput(formData);
  const slug = await uniqueSlug(input.title, async (candidate) => Boolean(await prisma.song.findUnique({ where: { slug: candidate } })));
  const song = await prisma.song.create({
    data: {
      ...input,
      slug,
      tags: { connectOrCreate: await tagConnections(input.tags) },
      playlistSongs: {
        create: input.playlistIds.map((playlistId, index) => ({
          playlistId,
          position: index + 1
        }))
      }
    }
  });

  revalidatePath("/");
  redirect(`/songs/${song.id}`);
}

export async function updateSong(id: string, formData: FormData) {
  const input = songInput(formData);
  const current = await prisma.song.findUniqueOrThrow({ where: { id }, select: { slug: true, title: true } });
  const slug =
    current.title === input.title
      ? current.slug
      : await uniqueSlug(input.title, async (candidate) => Boolean(await prisma.song.findFirst({ where: { slug: candidate, NOT: { id } } })));

  await prisma.$transaction([
    prisma.playlistSong.deleteMany({ where: { songId: id } }),
    prisma.song.update({
      where: { id },
      data: {
        ...input,
        slug,
        tags: { set: [], connectOrCreate: await tagConnections(input.tags) },
        playlistSongs: {
          create: input.playlistIds.map((playlistId, index) => ({
            playlistId,
            position: index + 1
          }))
        }
      }
    })
  ]);

  revalidatePath("/");
  revalidatePath("/songs");
  revalidatePath(`/songs/${id}`);
  redirect(`/songs/${id}`);
}

export async function deleteSong(id: string) {
  await prisma.song.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/songs");
  redirect("/songs");
}

export async function duplicateSong(id: string) {
  const song = await prisma.song.findUniqueOrThrow({ where: { id }, include: { tags: true } });
  const title = `${song.title} Copy`;
  const slug = await uniqueSlug(title, async (candidate) => Boolean(await prisma.song.findUnique({ where: { slug: candidate } })));
  const duplicate = await prisma.song.create({
    data: {
      title,
      slug,
      status: "DRAFT",
      mood: song.mood,
      theme: song.theme,
      language: song.language,
      fullLyrics: song.fullLyrics,
      shortVersion: song.shortVersion,
      hookText: song.hookText,
      youtubeTitle: song.youtubeTitle,
      youtubeDescription: song.youtubeDescription,
      websiteExcerpt: song.websiteExcerpt,
      notes: song.notes,
      hasCoverArt: song.hasCoverArt,
      hasFullVersion: song.hasFullVersion,
      hasShortVersion: song.hasShortVersion,
      tags: { connect: song.tags.map((tag) => ({ id: tag.id })) }
    }
  });

  revalidatePath("/songs");
  redirect(`/songs/${duplicate.id}`);
}

export async function markSongReady(id: string) {
  await prisma.song.update({ where: { id }, data: { status: "READY" } });
  revalidatePath("/");
  revalidatePath("/songs");
}

export async function generateMetadata(id: string) {
  const song = await prisma.song.findUniqueOrThrow({ where: { id } });
  const [youtubeTitle, youtubeDescription, shortVersion, websiteExcerpt] = await Promise.all([
    generateYoutubeTitle(song),
    generateYoutubeDescription(song),
    generateShortVersion(song),
    generateWebsiteExcerpt(song)
  ]);

  await prisma.song.update({
    where: { id },
    data: {
      youtubeTitle,
      youtubeDescription,
      shortVersion,
      websiteExcerpt,
      hasShortVersion: Boolean(shortVersion)
    }
  });

  await prisma.aIGenerationLog.create({
    data: {
      songId: id,
      kind: AIGenerationKind.OTHER,
      prompt: "Generate mock metadata for YouTube, website excerpt, and suspiro short version.",
      result: JSON.stringify({ youtubeTitle, youtubeDescription, shortVersion, websiteExcerpt } satisfies Prisma.JsonObject)
    }
  });

  revalidatePath(`/songs/${id}`);
  revalidatePath("/workflow");
  redirect(`/songs/${id}`);
}
