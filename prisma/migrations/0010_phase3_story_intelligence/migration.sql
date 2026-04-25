ALTER TYPE "LinkableType" ADD VALUE IF NOT EXISTS 'SCENE';
ALTER TYPE "LinkableType" ADD VALUE IF NOT EXISTS 'STORY_ENTITY';

CREATE TYPE "StoryEntityType" AS ENUM ('CHARACTER', 'LOCATION', 'OBJECT', 'ORGANIZATION', 'CONCEPT', 'UNKNOWN');

ALTER TABLE "DocumentVersion" ADD COLUMN "label" TEXT;

CREATE TABLE "Scene" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "povCharacter" TEXT,
  "location" TEXT,
  "goal" TEXT,
  "conflict" TEXT,
  "outcome" TEXT,
  "emotionalTone" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "startMarker" TEXT,
  "endMarker" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryEntity" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "StoryEntityType" NOT NULL DEFAULT 'UNKNOWN',
  "description" TEXT NOT NULL DEFAULT '',
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedNoteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntityMention" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "sourceType" "LinkableType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "position" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  CONSTRAINT "EntityMention_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Scene_documentId_sortOrder_idx" ON "Scene"("documentId", "sortOrder");
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");
CREATE INDEX "Scene_userId_idx" ON "Scene"("userId");
CREATE UNIQUE INDEX "StoryEntity_projectId_name_key" ON "StoryEntity"("projectId", "name");
CREATE INDEX "StoryEntity_projectId_type_idx" ON "StoryEntity"("projectId", "type");
CREATE INDEX "StoryEntity_userId_idx" ON "StoryEntity"("userId");
CREATE INDEX "StoryEntity_linkedNoteId_idx" ON "StoryEntity"("linkedNoteId");
CREATE INDEX "EntityMention_projectId_idx" ON "EntityMention"("projectId");
CREATE INDEX "EntityMention_entityId_idx" ON "EntityMention"("entityId");
CREATE INDEX "EntityMention_sourceType_sourceId_idx" ON "EntityMention"("sourceType", "sourceId");
CREATE INDEX "EntityMention_userId_idx" ON "EntityMention"("userId");

ALTER TABLE "Scene" ADD CONSTRAINT "Scene_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryEntity" ADD CONSTRAINT "StoryEntity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryEntity" ADD CONSTRAINT "StoryEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityMention" ADD CONSTRAINT "EntityMention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityMention" ADD CONSTRAINT "EntityMention_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "StoryEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityMention" ADD CONSTRAINT "EntityMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
