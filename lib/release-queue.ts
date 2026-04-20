import type { ReleaseSong } from "@/lib/release-recommendations";
import { releaseRecommendation } from "@/lib/release-recommendations";

export function buildReleaseQueue(songs: ReleaseSong[]) {
  const items = songs
    .map((song) => ({ song, recommendation: releaseRecommendation(song) }))
    .sort((a, b) => b.recommendation.score - a.recommendation.score);

  return {
    items,
    readyNow: items.filter((item) => item.recommendation.label === "Publish Now"),
    nearlyReady: items.filter((item) => item.recommendation.signals.missingOnlyOneThing),
    bestForShorts: items.filter((item) => item.recommendation.signals.readyForShorts),
    bestForFullRelease: items.filter((item) => item.recommendation.signals.readyForYoutube),
    bestForWebsite: items.filter((item) => item.recommendation.signals.readyForWebsite),
    staleDrafts: items.filter((item) => item.recommendation.signals.staleDraft),
    recentlyPrepared: items.filter((item) => item.recommendation.signals.recentlyUpdated || item.recommendation.signals.hasRecentAIGeneration)
  };
}
