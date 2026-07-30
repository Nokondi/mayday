-- CreateEnum
CREATE TYPE "PostNotificationFrequency" AS ENUM ('IMMEDIATE', 'WEEKLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyCommunityPosts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "postNotificationFrequency" "PostNotificationFrequency" NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN "lastPostDigestAt" TIMESTAMP(3);
