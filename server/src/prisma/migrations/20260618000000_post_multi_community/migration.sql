-- CreateTable
CREATE TABLE "PostCommunity" (
    "postId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,

    CONSTRAINT "PostCommunity_pkey" PRIMARY KEY ("postId","communityId")
);

-- CreateIndex
CREATE INDEX "PostCommunity_communityId_idx" ON "PostCommunity"("communityId");

-- AddForeignKey
ALTER TABLE "PostCommunity" ADD CONSTRAINT "PostCommunity_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCommunity" ADD CONSTRAINT "PostCommunity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: carry every existing single-community link into the join table
-- before the old column is dropped, so no scoping is lost.
INSERT INTO "PostCommunity" ("postId", "communityId")
SELECT "id", "communityId" FROM "Post" WHERE "communityId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_communityId_fkey";

-- DropIndex
DROP INDEX "Post_communityId_idx";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "communityId";
