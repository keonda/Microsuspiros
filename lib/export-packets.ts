import type { Prisma } from "@prisma/client";
import { getPublicAssetUrl } from "@/lib/asset-utils";

export type SongPacketSong = Prisma.SongGetPayload<{
  include: {
    tags: true;
    assets: true;
    scheduledReleases: true;
    campaignItems: { include: { campaign: true } };
  };
}>;

export function buildSongExportPackets(song: SongPacketSong) {
  const assets = song.assets.map((asset) => ({
    type: asset.type,
    title: asset.title,
    url: getPublicAssetUrl(asset),
    fileName: asset.fileName
  }));

  const base = {
    title: song.title,
    youtubeTitle: song.youtubeTitle,
    youtubeDescription: song.youtubeDescription,
    excerpt: song.websiteExcerpt,
    shortVersion: song.shortVersion,
    fullLyrics: song.fullLyrics,
    hookText: song.hookText,
    tags: song.tags.map((tag) => tag.name),
    assets,
    schedule: song.scheduledReleases.map((release) => ({
      title: release.title,
      platform: release.platform,
      contentType: release.contentType,
      scheduledFor: release.scheduledFor
    })),
    campaigns: song.campaignItems.map((item) => ({
      title: item.campaign.title,
      itemType: item.itemType
    }))
  };

  return {
    publishPacket: base,
    youtubePacket: {
      title: song.youtubeTitle || song.title,
      description: song.youtubeDescription,
      tags: base.tags,
      assets
    },
    websitePacket: {
      title: song.title,
      excerpt: song.websiteExcerpt,
      hookText: song.hookText,
      assets
    },
    shortsPacket: {
      title: song.title,
      shortVersion: song.shortVersion,
      hookText: song.hookText,
      assets: assets.filter((asset) => asset.type === "AUDIO_SHORT" || asset.type === "VIDEO_SHORT" || asset.type === "COVER_ART")
    }
  };
}

export type CampaignPacketCampaign = Prisma.ReleaseCampaignGetPayload<{
  include: {
    items: { include: { song: { include: { tags: true } }; playlist: true } };
    scheduledReleases: true;
  };
}>;

export function buildCampaignExportPacket(campaign: CampaignPacketCampaign) {
  return {
    title: campaign.title,
    goal: campaign.goal,
    status: campaign.status,
    description: campaign.description,
    notes: campaign.notes,
    items: campaign.items.map((item) => ({
      type: item.itemType,
      title: item.title || item.song?.title || item.playlist?.title,
      priority: item.priority,
      tags: item.song?.tags.map((tag) => tag.name) || []
    })),
    releases: campaign.scheduledReleases.map((release) => ({
      title: release.title,
      platform: release.platform,
      contentType: release.contentType,
      scheduledFor: release.scheduledFor,
      status: release.status
    }))
  };
}
