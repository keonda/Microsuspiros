CREATE TYPE "ExternalSyncStatus" AS ENUM ('NONE', 'LINKED', 'SYNCED', 'ERROR');

ALTER TABLE "PublishEvent" ADD COLUMN "externalId" TEXT;
ALTER TABLE "PublishEvent" ADD COLUMN "externalUrl" TEXT;
ALTER TABLE "PublishEvent" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "PublishEvent" ADD COLUMN "syncStatus" "ExternalSyncStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "PublishEvent" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "PublishEvent" ADD COLUMN "syncError" TEXT;

CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "songId" TEXT,
  "publishEventId" TEXT,
  "platform" "PublishPlatform" NOT NULL DEFAULT 'OTHER',
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "views" INTEGER,
  "likes" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "watchTime" INTEGER,
  "ctr" DOUBLE PRECISION,
  "retention" DOUBLE PRECISION,
  "rawJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_key_key" ON "UserPreference"("key");
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");
CREATE INDEX "PublishEvent_externalId_idx" ON "PublishEvent"("externalId");
CREATE INDEX "PublishEvent_syncStatus_idx" ON "PublishEvent"("syncStatus");
CREATE INDEX "AnalyticsSnapshot_songId_idx" ON "AnalyticsSnapshot"("songId");
CREATE INDEX "AnalyticsSnapshot_publishEventId_idx" ON "AnalyticsSnapshot"("publishEventId");
CREATE INDEX "AnalyticsSnapshot_platform_idx" ON "AnalyticsSnapshot"("platform");
CREATE INDEX "AnalyticsSnapshot_snapshotDate_idx" ON "AnalyticsSnapshot"("snapshotDate");

ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_publishEventId_fkey" FOREIGN KEY ("publishEventId") REFERENCES "PublishEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
