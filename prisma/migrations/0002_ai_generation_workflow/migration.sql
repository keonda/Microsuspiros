ALTER TYPE "AIGenerationKind" ADD VALUE IF NOT EXISTS 'HOOK_TEXT';

ALTER TABLE "AIGenerationLog"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mock',
  ADD COLUMN "accepted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AIGenerationLog_accepted_idx" ON "AIGenerationLog"("accepted");
