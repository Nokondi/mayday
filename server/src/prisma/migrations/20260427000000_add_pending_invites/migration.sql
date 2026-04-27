-- CreateEnum
CREATE TYPE "PendingInviteStatus" AS ENUM ('PENDING', 'CLAIMED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "PendingCommunityInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "PendingInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingCommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingOrganizationInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "PendingInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingOrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingCommunityInvite_token_key" ON "PendingCommunityInvite"("token");

-- CreateIndex
CREATE INDEX "PendingCommunityInvite_email_status_idx" ON "PendingCommunityInvite"("email", "status");

-- CreateIndex
CREATE INDEX "PendingCommunityInvite_status_idx" ON "PendingCommunityInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCommunityInvite_communityId_email_key" ON "PendingCommunityInvite"("communityId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrganizationInvite_token_key" ON "PendingOrganizationInvite"("token");

-- CreateIndex
CREATE INDEX "PendingOrganizationInvite_email_status_idx" ON "PendingOrganizationInvite"("email", "status");

-- CreateIndex
CREATE INDEX "PendingOrganizationInvite_status_idx" ON "PendingOrganizationInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingOrganizationInvite_organizationId_email_key" ON "PendingOrganizationInvite"("organizationId", "email");

-- AddForeignKey
ALTER TABLE "PendingCommunityInvite" ADD CONSTRAINT "PendingCommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingCommunityInvite" ADD CONSTRAINT "PendingCommunityInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrganizationInvite" ADD CONSTRAINT "PendingOrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingOrganizationInvite" ADD CONSTRAINT "PendingOrganizationInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
