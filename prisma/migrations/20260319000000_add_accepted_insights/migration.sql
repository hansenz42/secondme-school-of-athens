-- CreateTable
CREATE TABLE "accepted_insights" (
    "id" TEXT NOT NULL,
    "insightIndex" INTEGER NOT NULL,
    "insightText" TEXT NOT NULL,
    "eventId" INTEGER,
    "userId" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accepted_insights_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "accepted_insights_summaryId_topicId_insightIndex_key" ON "accepted_insights"("summaryId", "topicId", "insightIndex");
-- CreateIndex
CREATE INDEX "accepted_insights_userId_idx" ON "accepted_insights"("userId");
-- AddForeignKey
ALTER TABLE "accepted_insights"
ADD CONSTRAINT "accepted_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "accepted_insights"
ADD CONSTRAINT "accepted_insights_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "wander_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;