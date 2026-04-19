import type { Song } from "@prisma/client";

type ReadinessSong = Pick<
  Song,
  | "fullLyrics"
  | "shortVersion"
  | "youtubeTitle"
  | "youtubeDescription"
  | "websiteExcerpt"
  | "hasCoverArt"
  | "hasShortVersion"
  | "hasFullVersion"
  | "publishedYoutube"
  | "publishedWebsite"
>;

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function songReadiness(song: ReadinessSong) {
  const report = {
    hasLyrics: hasText(song.fullLyrics) || song.hasFullVersion,
    hasShortVersion: hasText(song.shortVersion) || song.hasShortVersion,
    hasYoutubeTitle: hasText(song.youtubeTitle),
    hasYoutubeDescription: hasText(song.youtubeDescription),
    hasExcerpt: hasText(song.websiteExcerpt),
    hasCoverArt: song.hasCoverArt,
    readyForYoutube: false,
    readyForWebsite: false,
    fullyPublishable: false,
    missing: [] as string[]
  };

  const checks: Array<[boolean, string]> = [
    [report.hasLyrics, "lyrics"],
    [report.hasShortVersion, "short version"],
    [report.hasYoutubeTitle, "YouTube title"],
    [report.hasYoutubeDescription, "YouTube description"],
    [report.hasExcerpt, "website excerpt"],
    [report.hasCoverArt, "cover art"]
  ];

  report.missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  report.readyForYoutube = report.hasLyrics && report.hasShortVersion && report.hasYoutubeTitle && report.hasYoutubeDescription && report.hasCoverArt;
  report.readyForWebsite = report.hasLyrics && report.hasShortVersion && report.hasExcerpt && report.hasCoverArt;
  report.fullyPublishable = report.readyForYoutube && report.readyForWebsite && !song.publishedYoutube && !song.publishedWebsite;

  return report;
}
