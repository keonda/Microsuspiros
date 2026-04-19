import type { Song } from "@prisma/client";

type SongLike = Pick<Song, "title" | "mood" | "theme" | "hookText" | "shortVersion" | "fullLyrics">;

export async function generateYoutubeTitle(song: SongLike) {
  const mood = song.mood ? ` | ${song.mood}` : "";
  return `${song.title}${mood} - MicroSuspiros`;
}

export async function generateYoutubeDescription(song: SongLike) {
  const theme = song.theme ? `Tema: ${song.theme}.` : "Una pieza breve para quedarse un momento.";
  const hook = song.hookText || song.shortVersion || "Un suspiro hecho cancion para escuchar despacio.";
  return `${hook}\n\n${theme}\n\nMicroSuspiros: canciones pequenas para emociones grandes.`;
}

export async function generateShortVersion(song: SongLike) {
  if (song.shortVersion) return song.shortVersion;
  const source = song.hookText || song.fullLyrics || song.title;
  return source.length > 220 ? `${source.slice(0, 217).trim()}...` : source;
}

export async function generateWebsiteExcerpt(song: SongLike) {
  return song.hookText || `Un MicroSuspiro sobre ${song.theme || "lo que queda latiendo"} con tono ${song.mood || "intimo"}.`;
}
