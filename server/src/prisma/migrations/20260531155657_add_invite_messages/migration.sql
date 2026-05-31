-- AlterTable
ALTER TABLE "CommunityInvite" ADD COLUMN     "inviteMessageId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "OrganizationInvite" ADD COLUMN     "inviteMessageId" TEXT;
