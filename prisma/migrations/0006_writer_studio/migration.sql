CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ProjectStatus" AS ENUM ('IDEA', 'DRAFTING', 'REVISING', 'COMPLETE', 'ARCHIVED');
CREATE TYPE "FolderKind" AS ENUM ('MANUSCRIPT', 'STORY_NOTES', 'RESEARCH', 'BRAINSTORM', 'RESOURCES', 'TRASH');
CREATE TYPE "DocumentKind" AS ENUM ('MANUSCRIPT', 'STORY_NOTE', 'RESEARCH');
CREATE TYPE "StoryNoteType" AS ENUM ('CHARACTER', 'LOCATION', 'SCENE_IDEA', 'PLOT_THREAD', 'TIMELINE_NOTE', 'WORLDBUILDING', 'GENERAL');
CREATE TYPE "ResourceLinkType" AS ENUM ('DOCUMENT', 'STORY_NOTE', 'RESEARCH_NOTE', 'BRAINSTORM_CARD');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT,
  "genre" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'IDEA',
  "coverImage" TEXT,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Folder" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "FolderKind" NOT NULL DEFAULT 'MANUSCRIPT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "DocumentKind" NOT NULL DEFAULT 'MANUSCRIPT',
  "contentJson" JSONB,
  "contentHtml" TEXT NOT NULL DEFAULT '',
  "plainText" TEXT NOT NULL DEFAULT '',
  "wordCount" INTEGER NOT NULL DEFAULT 0,
  "charCount" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isTrash" BOOLEAN NOT NULL DEFAULT false,
  "folderId" TEXT,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryNote" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "StoryNoteType" NOT NULL DEFAULT 'GENERAL',
  "body" TEXT NOT NULL DEFAULT '',
  "tagsText" TEXT NOT NULL DEFAULT '',
  "linkedDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNote" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceTitle" TEXT,
  "sourceUrl" TEXT,
  "author" TEXT,
  "excerpt" TEXT,
  "summary" TEXT NOT NULL DEFAULT '',
  "personalNotes" TEXT NOT NULL DEFAULT '',
  "tagsText" TEXT NOT NULL DEFAULT '',
  "linkedResourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrainstormBoard" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrainstormBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrainstormColumn" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "boardId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrainstormColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrainstormCard" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '#f2d7a2',
  "tagsText" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "boardId" TEXT NOT NULL,
  "columnId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrainstormCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "tagsText" TEXT NOT NULL DEFAULT '',
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceLink" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "linkType" "ResourceLinkType" NOT NULL,
  "documentId" TEXT,
  "storyNoteId" TEXT,
  "researchNoteId" TEXT,
  "brainstormCardId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WriterTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WriterTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_DocumentTags" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_DocumentTags_AB_pkey" PRIMARY KEY ("A","B"));
CREATE TABLE "_StoryNoteTags" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_StoryNoteTags_AB_pkey" PRIMARY KEY ("A","B"));
CREATE TABLE "_ResearchNoteTags" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_ResearchNoteTags_AB_pkey" PRIMARY KEY ("A","B"));
CREATE TABLE "_BrainstormCardTags" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_BrainstormCardTags_AB_pkey" PRIMARY KEY ("A","B"));
CREATE TABLE "_ResourceTags" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_ResourceTags_AB_pkey" PRIMARY KEY ("A","B"));

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_disabled_idx" ON "User"("disabled");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");
CREATE INDEX "Folder_projectId_kind_idx" ON "Folder"("projectId", "kind");
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
CREATE INDEX "Document_projectId_kind_sortOrder_idx" ON "Document"("projectId", "kind", "sortOrder");
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_isTrash_idx" ON "Document"("isTrash");
CREATE INDEX "StoryNote_projectId_type_idx" ON "StoryNote"("projectId", "type");
CREATE INDEX "StoryNote_userId_idx" ON "StoryNote"("userId");
CREATE INDEX "ResearchNote_projectId_idx" ON "ResearchNote"("projectId");
CREATE INDEX "ResearchNote_userId_idx" ON "ResearchNote"("userId");
CREATE INDEX "BrainstormBoard_projectId_idx" ON "BrainstormBoard"("projectId");
CREATE INDEX "BrainstormBoard_userId_idx" ON "BrainstormBoard"("userId");
CREATE INDEX "BrainstormColumn_boardId_sortOrder_idx" ON "BrainstormColumn"("boardId", "sortOrder");
CREATE INDEX "BrainstormColumn_projectId_idx" ON "BrainstormColumn"("projectId");
CREATE INDEX "BrainstormCard_boardId_idx" ON "BrainstormCard"("boardId");
CREATE INDEX "BrainstormCard_columnId_sortOrder_idx" ON "BrainstormCard"("columnId", "sortOrder");
CREATE INDEX "BrainstormCard_projectId_idx" ON "BrainstormCard"("projectId");
CREATE INDEX "BrainstormCard_userId_idx" ON "BrainstormCard"("userId");
CREATE INDEX "Resource_projectId_idx" ON "Resource"("projectId");
CREATE INDEX "Resource_userId_idx" ON "Resource"("userId");
CREATE INDEX "Resource_mimeType_idx" ON "Resource"("mimeType");
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");
CREATE INDEX "ResourceLink_resourceId_idx" ON "ResourceLink"("resourceId");
CREATE INDEX "ResourceLink_linkType_idx" ON "ResourceLink"("linkType");
CREATE INDEX "ResourceLink_documentId_idx" ON "ResourceLink"("documentId");
CREATE INDEX "ResourceLink_storyNoteId_idx" ON "ResourceLink"("storyNoteId");
CREATE INDEX "ResourceLink_researchNoteId_idx" ON "ResourceLink"("researchNoteId");
CREATE INDEX "ResourceLink_brainstormCardId_idx" ON "ResourceLink"("brainstormCardId");
CREATE UNIQUE INDEX "WriterTag_projectId_slug_key" ON "WriterTag"("projectId", "slug");
CREATE INDEX "WriterTag_projectId_idx" ON "WriterTag"("projectId");
CREATE INDEX "_DocumentTags_B_index" ON "_DocumentTags"("B");
CREATE INDEX "_StoryNoteTags_B_index" ON "_StoryNoteTags"("B");
CREATE INDEX "_ResearchNoteTags_B_index" ON "_ResearchNoteTags"("B");
CREATE INDEX "_BrainstormCardTags_B_index" ON "_BrainstormCardTags"("B");
CREATE INDEX "_ResourceTags_B_index" ON "_ResourceTags"("B");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryNote" ADD CONSTRAINT "StoryNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryNote" ADD CONSTRAINT "StoryNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormBoard" ADD CONSTRAINT "BrainstormBoard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormBoard" ADD CONSTRAINT "BrainstormBoard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormColumn" ADD CONSTRAINT "BrainstormColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "BrainstormBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormColumn" ADD CONSTRAINT "BrainstormColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormCard" ADD CONSTRAINT "BrainstormCard_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "BrainstormBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormCard" ADD CONSTRAINT "BrainstormCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BrainstormColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormCard" ADD CONSTRAINT "BrainstormCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrainstormCard" ADD CONSTRAINT "BrainstormCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_storyNoteId_fkey" FOREIGN KEY ("storyNoteId") REFERENCES "StoryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_researchNoteId_fkey" FOREIGN KEY ("researchNoteId") REFERENCES "ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceLink" ADD CONSTRAINT "ResourceLink_brainstormCardId_fkey" FOREIGN KEY ("brainstormCardId") REFERENCES "BrainstormCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WriterTag" ADD CONSTRAINT "WriterTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DocumentTags" ADD CONSTRAINT "_DocumentTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DocumentTags" ADD CONSTRAINT "_DocumentTags_B_fkey" FOREIGN KEY ("B") REFERENCES "WriterTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_StoryNoteTags" ADD CONSTRAINT "_StoryNoteTags_A_fkey" FOREIGN KEY ("A") REFERENCES "StoryNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_StoryNoteTags" ADD CONSTRAINT "_StoryNoteTags_B_fkey" FOREIGN KEY ("B") REFERENCES "WriterTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ResearchNoteTags" ADD CONSTRAINT "_ResearchNoteTags_A_fkey" FOREIGN KEY ("A") REFERENCES "ResearchNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ResearchNoteTags" ADD CONSTRAINT "_ResearchNoteTags_B_fkey" FOREIGN KEY ("B") REFERENCES "WriterTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BrainstormCardTags" ADD CONSTRAINT "_BrainstormCardTags_A_fkey" FOREIGN KEY ("A") REFERENCES "BrainstormCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BrainstormCardTags" ADD CONSTRAINT "_BrainstormCardTags_B_fkey" FOREIGN KEY ("B") REFERENCES "WriterTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ResourceTags" ADD CONSTRAINT "_ResourceTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ResourceTags" ADD CONSTRAINT "_ResourceTags_B_fkey" FOREIGN KEY ("B") REFERENCES "WriterTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
