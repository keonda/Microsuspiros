"use server";

import { AIGenerationKind, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateAI } from "@/lib/ai";
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
  const { tags, playlistIds, ...songData } = input;
  const slug = await uniqueSlug(input.title, async (candidate) => Boolean(await prisma.song.findUnique({ where: { slug: candidate } })));
  const song = await prisma.song.create({
    data: {
      ...songData,
      slug,
      tags: { connectOrCreate: await tagConnections(tags) },
      playlistSongs: {
        create: playlistIds.map((playlistId, index) => ({
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
  const { tags, playlistIds, ...songData } = input;
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
        ...songData,
        slug,
        tags: { set: [], connectOrCreate: await tagConnections(tags) },
        playlistSongs: {
          create: playlistIds.map((playlistId, index) => ({
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
      publishedYoutube: false,
      publishedWebsite: false,
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
  revalidatePath(`/songs/${id}`);
}

const aiFieldMap: Partial<Record<AIGenerationKind, keyof Prisma.SongUpdateInput>> = {
  YOUTUBE_TITLE: "youtubeTitle",
  YOUTUBE_DESCRIPTION: "youtubeDescription",
  SHORT_VERSION: "shortVersion",
  EXCERPT: "websiteExcerpt",
  HOOK_TEXT: "hookText"
};

const metadataKinds = [
  AIGenerationKind.YOUTUBE_TITLE,
  AIGenerationKind.YOUTUBE_DESCRIPTION,
  AIGenerationKind.SHORT_VERSION,
  AIGenerationKind.EXCERPT,
  AIGenerationKind.HOOK_TEXT,
  AIGenerationKind.TAGS
];

export async function generateSongAI(id: string, kind: AIGenerationKind) {
  const song = await prisma.song.findUniqueOrThrow({ where: { id } });
  const generated = await generateAI(kind, song);

  await prisma.aIGenerationLog.create({
    data: {
      songId: id,
      kind,
      provider: generated.provider,
      prompt: generated.prompt,
      result: generated.result
    }
  });

  revalidatePath(`/songs/${id}`);
  redirect(`/songs/${id}`);
}

export async function generateMetadata(id: string) {
  const song = await prisma.song.findUniqueOrThrow({ where: { id } });
  const generations = await Promise.all(metadataKinds.map((kind) => generateAI(kind, song)));

  await prisma.aIGenerationLog.createMany({
    data: generations.map((generation) => ({
      songId: id,
      kind: generation.kind,
      provider: generation.provider,
      prompt: generation.prompt,
      result: generation.result
    }))
  });

  const updateData: Prisma.SongUpdateInput = {};
  for (const generation of generations) {
    const field = aiFieldMap[generation.kind];
    if (field) {
      updateData[field] = generation.result as never;
    }
  }
  if (updateData.shortVersion) {
    updateData.hasShortVersion = true;
  }

  await prisma.song.update({ where: { id }, data: updateData });

  revalidatePath("/");
  revalidatePath("/songs");
  revalidatePath(`/songs/${id}`);
  revalidatePath("/workflow");
  redirect(`/songs/${id}`);
}

export async function applyAIGeneration(logId: string) {
  const log = await prisma.aIGenerationLog.findUniqueOrThrow({ where: { id: logId } });
  if (!log.songId) return;

  const field = aiFieldMap[log.kind];
  const data: Prisma.SongUpdateInput = {};

  if (field) {
    data[field] = log.result as never;
  }

  if (log.kind === AIGenerationKind.SHORT_VERSION) {
    data.hasShortVersion = true;
  }

  if (log.kind === AIGenerationKind.TAGS) {
    const names = csvTags(log.result);
    data.tags = { connectOrCreate: await tagConnections(names) };
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [prisma.aIGenerationLog.update({ where: { id: log.id }, data: { accepted: true } })];
  if (Object.keys(data).length) {
    operations.unshift(prisma.song.update({ where: { id: log.songId }, data }));
  }

  await prisma.$transaction(operations);

  revalidatePath("/");
  revalidatePath("/songs");
  revalidatePath(`/songs/${log.songId}`);
  revalidatePath("/workflow");
  redirect(`/songs/${log.songId}`);
}

export async function bulkSongAction(formData: FormData) {
  const ids = formStringArray(formData, "songIds");
  const action = formString(formData, "bulkAction");
  const tag = formString(formData, "bulkTag");

  if (!ids.length) {
    redirect("/songs");
  }

  if (action === "READY" || action === "ARCHIVED") {
    await prisma.song.updateMany({ where: { id: { in: ids } }, data: { status: action } });
  }

  if (action === "PUBLISHED_YOUTUBE") {
    await prisma.song.updateMany({ where: { id: { in: ids } }, data: { publishedYoutube: true } });
  }

  if (action === "PUBLISHED_WEBSITE") {
    await prisma.song.updateMany({ where: { id: { in: ids } }, data: { publishedWebsite: true } });
  }

  if (action === "ADD_TAG" && tag) {
    const connectOrCreate = await tagConnections([tag]);
    await prisma.$transaction(ids.map((id) => prisma.song.update({ where: { id }, data: { tags: { connectOrCreate } } })));
  }

  if (action === "GENERATE_METADATA") {
    for (const id of ids) {
      const song = await prisma.song.findUnique({ where: { id } });
      if (!song) continue;
      const generations = await Promise.all(metadataKinds.slice(0, 4).map((kind) => generateAI(kind, song)));
      await prisma.aIGenerationLog.createMany({
        data: generations.map((generation) => ({
          songId: id,
          kind: generation.kind,
          provider: generation.provider,
          prompt: generation.prompt,
          result: generation.result
        }))
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/songs");
  revalidatePath("/workflow");
  redirect("/songs");
}
