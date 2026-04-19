import { PlaylistType, SongStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().optional().transform((value) => value || null);
const requiredText = z.string().trim().min(1, "Required");

export const songSchema = z.object({
  title: requiredText,
  status: z.nativeEnum(SongStatus),
  mood: optionalText,
  theme: optionalText,
  language: z.string().trim().min(1).default("Spanish"),
  fullLyrics: optionalText,
  shortVersion: optionalText,
  hookText: optionalText,
  youtubeTitle: optionalText,
  youtubeDescription: optionalText,
  websiteExcerpt: optionalText,
  notes: optionalText,
  hasCoverArt: z.boolean().default(false),
  hasFullVersion: z.boolean().default(false),
  hasShortVersion: z.boolean().default(false),
  publishedYoutube: z.boolean().default(false),
  publishedWebsite: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  playlistIds: z.array(z.string()).default([])
});

export const playlistSchema = z.object({
  title: requiredText,
  type: z.nativeEnum(PlaylistType),
  description: optionalText
});

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formBool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function formStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export function csvTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
