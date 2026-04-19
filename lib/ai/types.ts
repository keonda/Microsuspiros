import type { AIGenerationKind, Song } from "@prisma/client";

export type AISong = Pick<
  Song,
  "title" | "mood" | "theme" | "language" | "fullLyrics" | "shortVersion" | "hookText" | "youtubeTitle" | "youtubeDescription" | "websiteExcerpt" | "notes"
>;

export type AIGenerationResult = {
  kind: AIGenerationKind;
  provider: string;
  prompt: string;
  result: string;
  usedFallback?: boolean;
};
