CREATE TYPE "SongStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PlaylistType" AS ENUM ('COMPILATION', 'SHORTS_SET', 'MOOD_SET', 'CUSTOM');
CREATE TYPE "AssetType" AS ENUM ('COVER_ART', 'AUDIO_FULL', 'AUDIO_SHORT', 'VIDEO_SHORT', 'VIDEO_FULL', 'OTHER');
CREATE TYPE "AIGenerationKind" AS ENUM ('YOUTUBE_TITLE', 'YOUTUBE_DESCRIPTION', 'SHORT_VERSION', 'EXCERPT', 'TAGS', 'NOTES', 'OTHER');

CREATE TABLE "Song" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "SongStatus" NOT NULL DEFAULT 'DRAFT',
  "mood" TEXT,
  "theme" TEXT,
  "language" TEXT NOT NULL DEFAULT 'Spanish',
  "fullLyrics" TEXT,
  "shortVersion" TEXT,
  "hookText" TEXT,
  "youtubeTitle" TEXT,
  "youtubeDescription" TEXT,
  "websiteExcerpt" TEXT,
  "notes" TEXT,
  "hasCoverArt" BOOLEAN NOT NULL DEFAULT false,
  "hasFullVersion" BOOLEAN NOT NULL DEFAULT false,
  "hasShortVersion" BOOLEAN NOT NULL DEFAULT false,
  "publishedYoutube" BOOLEAN NOT NULL DEFAULT false,
  "publishedWebsite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Playlist" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "PlaylistType" NOT NULL DEFAULT 'CUSTOM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaylistSong" (
  "playlistId" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PlaylistSong_pkey" PRIMARY KEY ("playlistId","songId")
);

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "type" "AssetType" NOT NULL DEFAULT 'OTHER',
  "title" TEXT NOT NULL,
  "url" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIGenerationLog" (
  "id" TEXT NOT NULL,
  "songId" TEXT,
  "kind" "AIGenerationKind" NOT NULL DEFAULT 'OTHER',
  "prompt" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIGenerationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_SongToTag" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");
CREATE INDEX "Song_status_idx" ON "Song"("status");
CREATE INDEX "Song_updatedAt_idx" ON "Song"("updatedAt");
CREATE INDEX "Song_mood_idx" ON "Song"("mood");
CREATE INDEX "Song_theme_idx" ON "Song"("theme");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
CREATE UNIQUE INDEX "Playlist_slug_key" ON "Playlist"("slug");
CREATE INDEX "Playlist_type_idx" ON "Playlist"("type");
CREATE INDEX "Playlist_updatedAt_idx" ON "Playlist"("updatedAt");
CREATE INDEX "PlaylistSong_songId_idx" ON "PlaylistSong"("songId");
CREATE INDEX "PlaylistSong_playlistId_position_idx" ON "PlaylistSong"("playlistId","position");
CREATE INDEX "Asset_songId_idx" ON "Asset"("songId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");
CREATE INDEX "AIGenerationLog_songId_idx" ON "AIGenerationLog"("songId");
CREATE INDEX "AIGenerationLog_kind_idx" ON "AIGenerationLog"("kind");
CREATE INDEX "AIGenerationLog_createdAt_idx" ON "AIGenerationLog"("createdAt");
CREATE UNIQUE INDEX "_SongToTag_AB_unique" ON "_SongToTag"("A", "B");
CREATE INDEX "_SongToTag_B_index" ON "_SongToTag"("B");

ALTER TABLE "PlaylistSong" ADD CONSTRAINT "PlaylistSong_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistSong" ADD CONSTRAINT "PlaylistSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIGenerationLog" ADD CONSTRAINT "AIGenerationLog_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_SongToTag" ADD CONSTRAINT "_SongToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SongToTag" ADD CONSTRAINT "_SongToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
