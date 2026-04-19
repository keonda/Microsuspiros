import { Prisma, SongStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getSongFilters() {
  const [moods, themes, languages] = await Promise.all([
    prisma.song.findMany({ distinct: ["mood"], where: { mood: { not: null } }, select: { mood: true }, orderBy: { mood: "asc" } }),
    prisma.song.findMany({ distinct: ["theme"], where: { theme: { not: null } }, select: { theme: true }, orderBy: { theme: "asc" } }),
    prisma.song.findMany({ distinct: ["language"], select: { language: true }, orderBy: { language: "asc" } })
  ]);

  return {
    moods: moods.map((item) => item.mood).filter(Boolean) as string[],
    themes: themes.map((item) => item.theme).filter(Boolean) as string[],
    languages: languages.map((item) => item.language)
  };
}

export function buildSongWhere(params: Record<string, string | string[] | undefined>) {
  const where: Prisma.SongWhereInput = {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { mood: { contains: q, mode: "insensitive" } },
      { theme: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { tags: { some: { name: { contains: q, mode: "insensitive" } } } }
    ];
  }

  if (typeof params.status === "string" && params.status) where.status = params.status as SongStatus;
  if (typeof params.mood === "string" && params.mood) where.mood = params.mood;
  if (typeof params.theme === "string" && params.theme) where.theme = params.theme;
  if (typeof params.language === "string" && params.language) where.language = params.language;

  for (const key of ["publishedYoutube", "publishedWebsite", "hasCoverArt"] as const) {
    if (params[key] === "true") where[key] = true;
    if (params[key] === "false") where[key] = false;
  }

  return where;
}
