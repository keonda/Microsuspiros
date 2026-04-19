import type { AIGenerationKind } from "@prisma/client";
import type { AISong } from "@/lib/ai/types";

function languageLine(song: AISong) {
  return song.language === "English" ? "Write in English." : "Write in Spanish.";
}

function songContext(song: AISong) {
  return [
    `Title: ${song.title}`,
    `Mood: ${song.mood || "intimate, calm"}`,
    `Theme: ${song.theme || "memory, longing, mature love"}`,
    `Language: ${song.language}`,
    song.hookText ? `Hook: ${song.hookText}` : "",
    song.shortVersion ? `Short version: ${song.shortVersion}` : "",
    song.fullLyrics ? `Lyrics: ${song.fullLyrics.slice(0, 1600)}` : "",
    song.notes ? `Notes: ${song.notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPrompt(kind: AIGenerationKind, song: AISong) {
  const base = `You are helping MicroSuspiros, a poetic song and shorts project with an intimate, melancholic, romantic, emotionally mature tone. ${languageLine(
    song
  )} Avoid cliches, hashtags unless requested, and generic marketing language. Return only the requested text.\n\n${songContext(song)}`;

  const tasks: Record<string, string> = {
    YOUTUBE_TITLE: "Create one YouTube title under 90 characters. It should feel searchable but poetic.",
    YOUTUBE_DESCRIPTION: "Create a YouTube description, 2-4 short paragraphs, warm and creator-ready.",
    SHORT_VERSION: "Extract or write a short suspiro version under 280 characters. It should feel complete on its own.",
    EXCERPT: "Create a website excerpt under 240 characters for a song archive page.",
    HOOK_TEXT: "Create a one-sentence emotional hook for this song.",
    TAGS: "Suggest 6 concise tags as comma-separated plain text.",
    NOTES: "Write a short production note for the creator.",
    OTHER: "Create a useful metadata draft for the creator."
  };

  return `${base}\n\nTask: ${tasks[kind] || tasks.OTHER}`;
}
