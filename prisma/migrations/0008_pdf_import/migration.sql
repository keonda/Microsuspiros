CREATE TYPE "ResourceExtractionStatus" AS ENUM ('NONE', 'PENDING', 'EXTRACTED', 'NO_TEXT', 'ENCRYPTED', 'TOO_LARGE', 'FAILED');

ALTER TABLE "Resource" ADD COLUMN "extractedText" TEXT;
ALTER TABLE "Resource" ADD COLUMN "extractionStatus" "ResourceExtractionStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Resource" ADD COLUMN "extractionError" TEXT;
ALTER TABLE "Resource" ADD COLUMN "pageCount" INTEGER;
