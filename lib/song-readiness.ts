import { AssetType, type Asset, type Song } from "@prisma/client";

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

type ReadinessAsset = Pick<Asset, "type">;

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function songReadiness(song: ReadinessSong & { assets?: ReadinessAsset[] }) {
  const assets = song.assets ?? [];
  const hasAsset = (type: AssetType) => assets.some((asset) => asset.type === type);
  const report = {
    hasLyrics: hasText(song.fullLyrics) || song.hasFullVersion,
    hasShortVersion: hasText(song.shortVersion) || song.hasShortVersion || hasAsset(AssetType.AUDIO_SHORT),
    hasYoutubeTitle: hasText(song.youtubeTitle),
    hasYoutubeDescription: hasText(song.youtubeDescription),
    hasExcerpt: hasText(song.websiteExcerpt),
    hasCoverArt: song.hasCoverArt || hasAsset(AssetType.COVER_ART),
    hasFullAudio: song.hasFullVersion || hasAsset(AssetType.AUDIO_FULL),
    hasShortAudio: song.hasShortVersion || hasAsset(AssetType.AUDIO_SHORT),
    hasYoutubeMetadata: false,
    readyForYoutube: false,
    readyForWebsite: false,
    readyForShorts: false,
    readyForCompilation: false,
    readyForYoutubePublish: false,
    readyForWebsitePublish: false,
    fullyPublishable: false,
    missing: [] as string[]
  };
  report.hasYoutubeMetadata = report.hasYoutubeTitle && report.hasYoutubeDescription;

  const checks: Array<[boolean, string]> = [
    [report.hasLyrics, "lyrics"],
    [report.hasShortVersion, "short version"],
    [report.hasYoutubeTitle, "YouTube title"],
    [report.hasYoutubeDescription, "YouTube description"],
    [report.hasExcerpt, "website excerpt"],
    [report.hasCoverArt, "cover art"],
    [report.hasFullAudio, "full audio"],
    [report.hasShortAudio, "short audio"]
  ];

  report.missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  report.readyForShorts = report.hasShortVersion && report.hasShortAudio && report.hasCoverArt && report.hasYoutubeMetadata;
  report.readyForCompilation = report.hasLyrics && report.hasFullAudio && report.hasCoverArt;
  report.readyForYoutube = report.hasLyrics && report.hasShortVersion && report.hasYoutubeTitle && report.hasYoutubeDescription && report.hasCoverArt;
  report.readyForWebsite = report.hasLyrics && report.hasShortVersion && report.hasExcerpt && report.hasCoverArt;
  report.readyForYoutubePublish = report.readyForYoutube && report.hasFullAudio;
  report.readyForWebsitePublish = report.readyForWebsite && report.hasFullAudio;
  report.fullyPublishable = report.readyForYoutubePublish && report.readyForWebsitePublish && report.readyForShorts && !song.publishedYoutube && !song.publishedWebsite;

  return report;
}
