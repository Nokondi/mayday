import type { NotificationCategory, Prisma, UrgencyLevel } from '@prisma/client';
import { prisma } from '../config/database.js';
import { getFriendIds } from './friend.service.js';
import { notify } from './notification.service.js';
import { URGENCY_ORDER } from './postNotification.service.js';

// A digest is due one week after the previous one (or one week after the user
// switched to WEEKLY — the settings route stamps lastPostDigestAt then).
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
// Cap the posts listed in the email; the notification still carries the total.
const MAX_DIGEST_POSTS = 20;

/** Post urgencies at or above the user's minimum preference. */
function urgenciesAtOrAbove(min: UrgencyLevel): UrgencyLevel[] {
  return URGENCY_ORDER.slice(URGENCY_ORDER.indexOf(min));
}

interface DigestUser {
  id: string;
  pushNotificationsEnabled: boolean;
  mutedEmailCategories: NotificationCategory[];
  mutedPushCategories: NotificationCategory[];
  minPostNotificationUrgency: UrgencyLevel;
  lastPostDigestAt: Date | null;
}

/**
 * An audience goes into the digest while the user can still receive it on at
 * least one channel. dispatch() then drops whichever channels are muted for
 * the digest as a whole.
 */
function audienceReachable(user: DigestUser, category: NotificationCategory): boolean {
  return (
    !user.mutedEmailCategories.includes(category) ||
    (user.pushNotificationsEnabled && !user.mutedPushCategories.includes(category))
  );
}

/**
 * Send one user's weekly digest: every post created since their last digest
 * that they would have been notified about immediately — friends' visible
 * posts and posts in their unmuted communities, filtered by minimum urgency.
 * Always advances lastPostDigestAt, even when there's nothing to send, so an
 * empty week doesn't make the next sweep re-scan the same window.
 */
async function sendDigestForUser(user: DigestUser, now: Date): Promise<void> {
  const since =
    user.lastPostDigestAt ?? new Date(now.getTime() - DIGEST_INTERVAL_MS);

  const audience: Prisma.PostWhereInput[] = [];
  const memberCommunityIds = new Set<string>();

  if (audienceReachable(user, 'COMMUNITY_POSTS')) {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: user.id, notifyNewPosts: true },
      select: { communityId: true },
    });
    memberships.forEach((m) => memberCommunityIds.add(m.communityId));
    if (memberships.length > 0) {
      audience.push({
        communities: {
          some: { communityId: { in: memberships.map((m) => m.communityId) } },
        },
      });
    }
  }

  if (audienceReachable(user, 'FRIEND_POSTS')) {
    const friendIds = await getFriendIds(user.id);
    if (friendIds.length > 0) {
      // Friends' posts the user can see: explicitly shared with friends, or
      // public (no community scoping).
      audience.push({
        authorId: { in: friendIds },
        OR: [{ sharedWithFriends: true }, { communities: { none: {} } }],
      });
    }
  }

  if (audience.length > 0) {
    const posts = await prisma.post.findMany({
      where: {
        createdAt: { gte: since },
        authorId: { not: user.id },
        urgency: { in: urgenciesAtOrAbove(user.minPostNotificationUrgency) },
        OR: audience,
      },
      select: {
        id: true,
        title: true,
        author: { select: { name: true } },
        communities: {
          select: { community: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (posts.length > 0) {
      await notify(user.id, {
        type: 'POST_DIGEST',
        count: posts.length,
        posts: posts.slice(0, MAX_DIGEST_POSTS).map((p) => {
          // Attribute the post to the recipient's own (unmuted) community
          // when it reached them that way; otherwise it's a friend's post.
          const via = p.communities.find((pc) =>
            memberCommunityIds.has(pc.community.id),
          );
          return {
            id: p.id,
            title: p.title,
            authorName: p.author.name,
            communityName: via?.community.name ?? null,
          };
        }),
      });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastPostDigestAt: now },
  });
}

/**
 * Find every WEEKLY user whose digest is due and send it. Per-user failures
 * are logged and skipped (that user's lastPostDigestAt is left unchanged, so
 * the next sweep retries them). Safe to call concurrently with post writes.
 */
export async function runPostDigestSweep(now = new Date()): Promise<void> {
  try {
    const due = await prisma.user.findMany({
      where: {
        postNotificationFrequency: 'WEEKLY',
        isBanned: false,
        emailVerified: true,
        OR: [
          { lastPostDigestAt: null },
          { lastPostDigestAt: { lte: new Date(now.getTime() - DIGEST_INTERVAL_MS) } },
        ],
      },
      select: {
        id: true,
        pushNotificationsEnabled: true,
        mutedEmailCategories: true,
        mutedPushCategories: true,
        minPostNotificationUrgency: true,
        lastPostDigestAt: true,
      },
    });

    for (const user of due) {
      try {
        await sendDigestForUser(user, now);
      } catch (err) {
        console.error(`[post-digest] failed for user ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[post-digest] sweep failed:', err);
  }
}

let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Start the hourly digest sweep. The due-check is timestamp-based
 * (lastPostDigestAt), so restarts can't double-send or lose a window. The
 * timer is unref'd so it never keeps the process alive on shutdown.
 */
export function startPostDigestScheduler(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    void runPostDigestSweep();
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
  // Catch up immediately on boot instead of waiting for the first tick.
  void runPostDigestSweep();
}

export function stopPostDigestScheduler(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
