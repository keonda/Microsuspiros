ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'LYRICS_DOC';

CREATE TYPE "AssetStorageType" AS ENUM ('LOCAL', 'EXTERNAL_URL');
CREATE TYPE "PublishPlatform" AS ENUM ('YOUTUBE', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'TIKTOK', 'OTHER');
CREATE TYPE "PublishContentType" AS ENUM ('FULL_SONG', 'SHORT', 'PLAYLIST', 'EXCERPT', 'OTHER');

ALTER TABLE "Asset"
  ALTER COLUMN "songId" DROP NOT NULL,
  ADD COLUMN "storageType" "AssetStorageType" NOT NULL DEFAULT 'EXTERNAL_URL',
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "path" TEXT,
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Asset_createdAt_idx" ON "Asset"("createdAt");

CREATE TABLE "PublishEvent" (
  "id" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "platform" "PublishPlatform" NOT NULL DEFAULT 'OTHER',
  "contentType" "PublishContentType" NOT NULL DEFAULT 'OTHER',
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "url" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublishEvent_songId_idx" ON "PublishEvent"("songId");
CREATE INDEX "PublishEvent_platform_idx" ON "PublishEvent"("platform");
CREATE INDEX "PublishEvent_publishedAt_idx" ON "PublishEvent"("publishedAt");

ALTER TABLE "PublishEvent" ADD CONSTRAINT "PublishEvent_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
