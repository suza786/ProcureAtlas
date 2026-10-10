ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "observedAt" DATETIME;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "llmCostKnown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "llmInputTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN "llmOutputTokens" INTEGER NOT NULL DEFAULT 0;
