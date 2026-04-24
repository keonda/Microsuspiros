CREATE TYPE "LinkableType" AS ENUM ('DOCUMENT', 'STORY_NOTE', 'RESEARCH_NOTE', 'BRAINSTORM_CARD', 'RESOURCE');
CREATE TYPE "AIProvider" AS ENUM ('GROQ');

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "contentJsonSnapshot" JSONB,
  "contentHtmlSnapshot" TEXT NOT NULL DEFAULT '',
  "plainTextSnapshot" TEXT NOT NULL DEFAULT '',
  "wordCountSnapshot" INTEGER NOT NULL DEFAULT 0,
  "changeSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalLink" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceType" "LinkableType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "targetType" "LinkableType",
  "targetId" TEXT,
  "rawText" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "excerpt" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AISettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AIProvider" NOT NULL DEFAULT 'GROQ',
  "apiKeyEncrypted" TEXT,
  "model" TEXT NOT NULL DEFAULT 'llama-3.1-8b-instant',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AISettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");
CREATE INDEX "DocumentVersion_userId_idx" ON "DocumentVersion"("userId");
CREATE INDEX "InternalLink_projectId_idx" ON "InternalLink"("projectId");
CREATE INDEX "InternalLink_sourceType_sourceId_idx" ON "InternalLink"("sourceType", "sourceId");
CREATE INDEX "InternalLink_targetType_targetId_idx" ON "InternalLink"("targetType", "targetId");
CREATE INDEX "InternalLink_normalizedText_idx" ON "InternalLink"("normalizedText");
CREATE UNIQUE INDEX "AISettings_userId_key" ON "AISettings"("userId");
CREATE INDEX "AISettings_provider_idx" ON "AISettings"("provider");

ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AISettings" ADD CONSTRAINT "AISettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
