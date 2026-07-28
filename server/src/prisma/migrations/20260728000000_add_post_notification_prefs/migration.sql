-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyFriendPosts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "minPostNotificationUrgency" "UrgencyLevel" NOT NULL DEFAULT 'LOW';

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN "notifyNewPosts" BOOLEAN NOT NULL DEFAULT true;
