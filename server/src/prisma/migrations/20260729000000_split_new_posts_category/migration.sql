-- Split the NEW_POSTS notification category into FRIEND_POSTS and
-- COMMUNITY_POSTS, and fold the old audience booleans (notifyFriendPosts /
-- notifyCommunityPosts) into the per-channel muted arrays.
--
-- Postgres can't remove an enum value, so the type is recreated. The muted
-- arrays pass through text[] while the old type is dropped.

-- 1. Detach the columns from the enum type.
ALTER TABLE "User"
  ALTER COLUMN "mutedEmailCategories" DROP DEFAULT,
  ALTER COLUMN "mutedPushCategories" DROP DEFAULT,
  ALTER COLUMN "mutedEmailCategories" TYPE text[] USING "mutedEmailCategories"::text[],
  ALTER COLUMN "mutedPushCategories" TYPE text[] USING "mutedPushCategories"::text[];

-- 2. NEW_POSTS muting applied to all post notifications → both new categories.
UPDATE "User"
SET "mutedEmailCategories" = array_remove("mutedEmailCategories", 'NEW_POSTS') || ARRAY['FRIEND_POSTS', 'COMMUNITY_POSTS']
WHERE 'NEW_POSTS' = ANY("mutedEmailCategories");

UPDATE "User"
SET "mutedPushCategories" = array_remove("mutedPushCategories", 'NEW_POSTS') || ARRAY['FRIEND_POSTS', 'COMMUNITY_POSTS']
WHERE 'NEW_POSTS' = ANY("mutedPushCategories");

-- 3. The old audience booleans were all-channel opt-outs: fold them in as
--    both-channel mutes so those users' choices are preserved exactly.
-- (The right-hand side of || must be cast: with a bare string literal Postgres
-- picks the array||array overload and tries to parse it as an array literal.)
UPDATE "User"
SET
  "mutedEmailCategories" = CASE
    WHEN 'FRIEND_POSTS' = ANY("mutedEmailCategories") THEN "mutedEmailCategories"
    ELSE "mutedEmailCategories" || 'FRIEND_POSTS'::text
  END,
  "mutedPushCategories" = CASE
    WHEN 'FRIEND_POSTS' = ANY("mutedPushCategories") THEN "mutedPushCategories"
    ELSE "mutedPushCategories" || 'FRIEND_POSTS'::text
  END
WHERE "notifyFriendPosts" = false;

UPDATE "User"
SET
  "mutedEmailCategories" = CASE
    WHEN 'COMMUNITY_POSTS' = ANY("mutedEmailCategories") THEN "mutedEmailCategories"
    ELSE "mutedEmailCategories" || 'COMMUNITY_POSTS'::text
  END,
  "mutedPushCategories" = CASE
    WHEN 'COMMUNITY_POSTS' = ANY("mutedPushCategories") THEN "mutedPushCategories"
    ELSE "mutedPushCategories" || 'COMMUNITY_POSTS'::text
  END
WHERE "notifyCommunityPosts" = false;

-- 4. Recreate the enum without NEW_POSTS and re-attach the columns.
DROP TYPE "NotificationCategory";
CREATE TYPE "NotificationCategory" AS ENUM ('INVITES', 'JOIN_REQUESTS', 'MESSAGES', 'COMMENTS', 'FRIEND_REQUESTS', 'ANNOUNCEMENTS', 'FRIEND_POSTS', 'COMMUNITY_POSTS');

ALTER TABLE "User"
  ALTER COLUMN "mutedEmailCategories" TYPE "NotificationCategory"[] USING "mutedEmailCategories"::"NotificationCategory"[],
  ALTER COLUMN "mutedPushCategories" TYPE "NotificationCategory"[] USING "mutedPushCategories"::"NotificationCategory"[],
  ALTER COLUMN "mutedEmailCategories" SET DEFAULT ARRAY[]::"NotificationCategory"[],
  ALTER COLUMN "mutedPushCategories" SET DEFAULT ARRAY[]::"NotificationCategory"[];

-- 5. Drop the superseded audience booleans.
ALTER TABLE "User" DROP COLUMN "notifyFriendPosts", DROP COLUMN "notifyCommunityPosts";
