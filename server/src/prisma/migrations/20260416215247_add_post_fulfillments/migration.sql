-- CreateTable
CREATE TABLE "PostFulfillment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostFulfillment_postId_idx" ON "PostFulfillment"("postId");

-- CreateIndex
CREATE INDEX "PostFulfillment_userId_idx" ON "PostFulfillment"("userId");

-- CreateIndex
CREATE INDEX "PostFulfillment_organizationId_idx" ON "PostFulfillment"("organizationId");

-- AddForeignKey
ALTER TABLE "PostFulfillment" ADD CONSTRAINT "PostFulfillment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFulfillment" ADD CONSTRAINT "PostFulfillment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFulfillment" ADD CONSTRAINT "PostFulfillment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
