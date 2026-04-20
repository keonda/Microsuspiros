ALTER TYPE "PublishContentType" ADD VALUE IF NOT EXISTS 'TEASER';

CREATE TYPE "ReleaseCampaignStatus" AS ENUM ('DRAFT', 'PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ReleaseCampaignGoal" AS ENUM ('SONG_LAUNCH', 'SHORTS_PUSH', 'PLAYLIST_DROP', 'WEBSITE_PUSH', 'MIXED');
CREATE TYPE "CampaignItemType" AS ENUM ('SONG', 'SHORT', 'PLAYLIST', 'WEBSITE_POST', 'EXCERPT', 'OTHER');
CREATE TYPE "ScheduledReleaseStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'PUBLISHED', 'SKIPPED', 'CANCELED');

CREATE TABLE "ReleaseCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ReleaseCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "goal" "ReleaseCampaignGoal" NOT NULL DEFAULT 'MIXED',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReleaseCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignItem" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "songId" TEXT,
  "playlistId" TEXT,
  "itemType" "CampaignItemType" NOT NULL DEFAULT 'OTHER',
  "title" TEXT,
  "notes" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledRelease" (
  "id" TEXT NOT NULL,
  "songId" TEXT,
  "playlistId" TEXT,
  "campaignId" TEXT,
  "platform" "PublishPlatform" NOT NULL DEFAULT 'OTHER',
  "contentType" "PublishContentType" NOT NULL DEFAULT 'OTHER',
  "status" "ScheduledReleaseStatus" NOT NULL DEFAULT 'PLANNED',
  "title" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "notes" TEXT,
  "ctaText" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReleaseCampaign_slug_key" ON "ReleaseCampaign"("slug");
CREATE INDEX "ReleaseCampaign_status_idx" ON "ReleaseCampaign"("status");
CREATE INDEX "ReleaseCampaign_goal_idx" ON "ReleaseCampaign"("goal");
CREATE INDEX "ReleaseCampaign_startDate_idx" ON "ReleaseCampaign"("startDate");
CREATE INDEX "CampaignItem_campaignId_idx" ON "CampaignItem"("campaignId");
CREATE INDEX "CampaignItem_songId_idx" ON "CampaignItem"("songId");
CREATE INDEX "CampaignItem_playlistId_idx" ON "CampaignItem"("playlistId");
CREATE INDEX "CampaignItem_priority_idx" ON "CampaignItem"("priority");
CREATE INDEX "ScheduledRelease_songId_idx" ON "ScheduledRelease"("songId");
CREATE INDEX "ScheduledRelease_playlistId_idx" ON "ScheduledRelease"("playlistId");
CREATE INDEX "ScheduledRelease_campaignId_idx" ON "ScheduledRelease"("campaignId");
CREATE INDEX "ScheduledRelease_platform_idx" ON "ScheduledRelease"("platform");
CREATE INDEX "ScheduledRelease_contentType_idx" ON "ScheduledRelease"("contentType");
CREATE INDEX "ScheduledRelease_status_idx" ON "ScheduledRelease"("status");
CREATE INDEX "ScheduledRelease_scheduledFor_idx" ON "ScheduledRelease"("scheduledFor");

ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReleaseCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledRelease" ADD CONSTRAINT "ScheduledRelease_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledRelease" ADD CONSTRAINT "ScheduledRelease_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledRelease" ADD CONSTRAINT "ScheduledRelease_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReleaseCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
