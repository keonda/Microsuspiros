import { SongStatus, type AIGenerationLog, type Asset, type CampaignItem, type PlaylistSong, type PublishEvent, type ScheduledRelease, type Song } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { songReadiness } from "@/lib/song-readiness";

export type ReleaseSong = Song & {
  assets: Asset[];
  publishEvents: PublishEvent[];
  scheduledReleases: ScheduledRelease[];
  campaignItems: CampaignItem[];
  aiGenerationLogs: AIGenerationLog[];
  playlistSongs: PlaylistSong[];
};

export function releaseRecommendation(song: ReleaseSong) {
  const readiness = songReadiness(song);
  const config = appConfig();
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - config.releaseQueueRecentDays);
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - config.releaseQueueStaleDays);

  const signals = {
    fullyPublishable: readiness.fullyPublishable,
    readyForShorts: readiness.readyForShorts,
    readyForYoutube: readiness.readyForYoutubePublish,
    readyForWebsite: readiness.readyForWebsitePublish,
    missingOnlyOneThing: readiness.missing.length === 1,
    recentlyUpdated: song.updatedAt >= recentCutoff,
    hasRecentAIGeneration: song.aiGenerationLogs.some((log) => log.createdAt >= recentCutoff),
    hasAssets: song.assets.length > 0,
    hasNoCampaign: song.campaignItems.length === 0,
    hasNoSchedule: song.scheduledReleases.length === 0,
    staleDraft: song.status === SongStatus.DRAFT && song.updatedAt <= staleCutoff
  };

  let score = 0;
  if (signals.fullyPublishable) score += 60;
  if (signals.readyForYoutube) score += 35;
  if (signals.readyForShorts) score += 25;
  if (signals.readyForWebsite) score += 20;
  if (signals.missingOnlyOneThing) score += 15;
  if (signals.recentlyUpdated) score += 10;
  if (signals.hasRecentAIGeneration) score += 8;
  if (signals.hasNoSchedule && (signals.readyForYoutube || signals.readyForShorts)) score += 12;
  if (signals.staleDraft) score -= 8;

  let label = "Needs shaping";
  const suggestions: string[] = [];

  if (signals.fullyPublishable) {
    label = "Publish Now";
    suggestions.push("Schedule the full song and a supporting short.");
  } else if (signals.readyForShorts) {
    label = "Good Shorts Candidate";
    suggestions.push("Schedule a short as a low-friction release.");
  } else if (signals.readyForYoutube) {
    label = "Good Full Release";
    suggestions.push("Schedule the YouTube release and prepare a website follow-up.");
  } else if (readiness.missing.includes("cover art")) {
    label = "Missing Cover";
    suggestions.push("Create or upload cover art before publishing.");
  } else if (readiness.missing.includes("short audio") || readiness.missing.includes("short version")) {
    label = "Needs Short Version";
    suggestions.push("Create a suspiro short before scheduling shorts content.");
  } else if (!readiness.hasYoutubeMetadata) {
    label = "Finish Metadata";
    suggestions.push("Generate or write YouTube title and description.");
  }

  if (signals.hasNoCampaign) suggestions.push("Add to a campaign or emotional release arc.");
  if (signals.hasNoSchedule && score > 20) suggestions.push("Add a scheduled release entry.");
  if (song.theme?.toLowerCase().includes("love") || song.mood?.toLowerCase().includes("melanch")) {
    suggestions.push("Good candidate for a mature love or tearjerker set.");
  }
  if (signals.staleDraft) suggestions.push("Old draft: decide whether to revive, archive, or duplicate.");

  return { score, label, readiness, signals, suggestions: suggestions.slice(0, 4) };
}
