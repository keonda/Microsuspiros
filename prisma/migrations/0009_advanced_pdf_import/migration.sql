CREATE TYPE "PdfImportStatus" AS ENUM ('EXTRACTED', 'NO_TEXT', 'IMPORTED', 'FAILED');

CREATE TABLE "PdfImportSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "extractedText" TEXT,
  "detectedSectionsJson" JSONB NOT NULL,
  "status" "PdfImportStatus" NOT NULL DEFAULT 'EXTRACTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PdfImportSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PdfImportedItem" (
  "id" TEXT NOT NULL,
  "importSessionId" TEXT NOT NULL,
  "targetType" "LinkableType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PdfImportedItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PdfImportSession_projectId_idx" ON "PdfImportSession"("projectId");
CREATE INDEX "PdfImportSession_resourceId_idx" ON "PdfImportSession"("resourceId");
CREATE INDEX "PdfImportSession_userId_idx" ON "PdfImportSession"("userId");
CREATE INDEX "PdfImportSession_status_idx" ON "PdfImportSession"("status");
CREATE INDEX "PdfImportedItem_importSessionId_idx" ON "PdfImportedItem"("importSessionId");
CREATE INDEX "PdfImportedItem_targetType_targetId_idx" ON "PdfImportedItem"("targetType", "targetId");
CREATE INDEX "PdfImportedItem_sortOrder_idx" ON "PdfImportedItem"("sortOrder");

ALTER TABLE "PdfImportSession" ADD CONSTRAINT "PdfImportSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfImportSession" ADD CONSTRAINT "PdfImportSession_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfImportSession" ADD CONSTRAINT "PdfImportSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PdfImportedItem" ADD CONSTRAINT "PdfImportedItem_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "PdfImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
