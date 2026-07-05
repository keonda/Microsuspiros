CREATE TABLE "CapturedEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "rawText" TEXT NOT NULL,
    "inferredTypes" TEXT[],
    "location" TEXT,
    "itemName" TEXT,
    "dueText" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapturedEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CapturedEntry_userId_createdAt_idx" ON "CapturedEntry"("userId", "createdAt");
CREATE INDEX "CapturedEntry_confirmed_dismissed_idx" ON "CapturedEntry"("confirmed", "dismissed");

ALTER TABLE "CapturedEntry" ADD CONSTRAINT "CapturedEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
