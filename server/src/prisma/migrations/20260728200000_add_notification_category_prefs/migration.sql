-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('INVITES', 'JOIN_REQUESTS', 'MESSAGES', 'COMMENTS', 'NEW_POSTS', 'FRIEND_REQUESTS', 'ANNOUNCEMENTS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mutedEmailCategories" "NotificationCategory"[] NOT NULL DEFAULT ARRAY[]::"NotificationCategory"[],
ADD COLUMN "mutedPushCategories" "NotificationCategory"[] NOT NULL DEFAULT ARRAY[]::"NotificationCategory"[];

-- Carry the old global email opt-out into the per-category prefs so users who
-- had disabled email notifications stay fully muted.
UPDATE "User"
SET "mutedEmailCategories" = ARRAY['INVITES', 'JOIN_REQUESTS', 'MESSAGES', 'COMMENTS', 'NEW_POSTS', 'FRIEND_REQUESTS', 'ANNOUNCEMENTS']::"NotificationCategory"[]
WHERE "emailNotificationsEnabled" = false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailNotificationsEnabled";
