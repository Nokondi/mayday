-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "links" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "links" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "links" JSONB;
