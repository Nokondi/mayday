import type { UrgencyLevel } from '@prisma/client';
import { prisma } from '../config/database.js';
import { getFriendIds } from './friend.service.js';
import { notifyMany } from './notification.service.js';

export const URGENCY_ORDER: UrgencyLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * The set of minimum-urgency preferences a post at `urgency` satisfies — i.e.
 * every level at or below it. A recipient is notified only when their
 * minPostNotificationUrgency is in this set.
 */
function satisfiedMinLevels(urgency: UrgencyLevel): UrgencyLevel[] {
  return URGENCY_ORDER.slice(0, URGENCY_ORDER.indexOf(urgency) + 1);
}

interface NewPostParams {
  postId: string;
  postTitle: string;
  urgency: UrgencyLevel;
  authorId: string;
  authorName: string;
  sharedWithFriends: boolean;
  communityIds: string[];
}

/**
 * Fan out NEW_POST notifications for a just-created post.
 *
 * Recipients:
 *  - the author's friends, when the post is visible to them (shared with
 *    friends, or public), unless they've muted friend posts
 *  - members of each attached community, unless they've muted that community
 *
 * Both sets are filtered by each recipient's minimum-urgency preference and
 * deduped — someone who qualifies as both friend and community member gets the
 * friend notification only. Recipients on a WEEKLY frequency are skipped here;
 * they pick the post up in their next digest (postDigest.service). Community
 * recipients also require the notifyCommunityPosts master toggle.
 * Fire-and-forget: failures are logged, never thrown, so they can't break the
 * post creation.
 */
export async function notifyNewPost(params: NewPostParams): Promise<void> {
  try {
    const allowedMinLevels = satisfiedMinLevels(params.urgency);

    // Friends can view the post when it's explicitly shared with friends or
    // fully public (no community scoping). Community-only posts are invisible
    // to non-member friends, so they get no friend notification.
    const visibleToFriends =
      params.sharedWithFriends || params.communityIds.length === 0;

    const notified = new Set<string>([params.authorId]);

    if (visibleToFriends) {
      const friendIds = await getFriendIds(params.authorId);
      if (friendIds.length > 0) {
        const friends = await prisma.user.findMany({
          where: {
            id: { in: friendIds },
            notifyFriendPosts: true,
            minPostNotificationUrgency: { in: allowedMinLevels },
            postNotificationFrequency: 'IMMEDIATE',
          },
          select: { id: true },
        });
        const recipientIds = friends
          .map((f) => f.id)
          .filter((id) => !notified.has(id));
        recipientIds.forEach((id) => notified.add(id));
        if (recipientIds.length > 0) {
          await notifyMany(recipientIds, {
            type: 'NEW_POST',
            postId: params.postId,
            postTitle: params.postTitle,
            authorId: params.authorId,
            authorName: params.authorName,
            audience: 'friend',
          });
        }
      }
    }

    if (params.communityIds.length === 0) return;

    const [communities, members] = await Promise.all([
      prisma.community.findMany({
        where: { id: { in: params.communityIds } },
        select: { id: true, name: true },
      }),
      prisma.communityMember.findMany({
        where: {
          communityId: { in: params.communityIds },
          userId: { not: params.authorId },
          notifyNewPosts: true,
          user: {
            notifyCommunityPosts: true,
            minPostNotificationUrgency: { in: allowedMinLevels },
            postNotificationFrequency: 'IMMEDIATE',
          },
        },
        select: { userId: true, communityId: true },
      }),
    ]);
    const nameById = new Map(communities.map((c) => [c.id, c.name]));

    // A member of several attached communities is notified once, under the
    // first attached community that includes them.
    for (const communityId of params.communityIds) {
      const recipientIds = members
        .filter((m) => m.communityId === communityId && !notified.has(m.userId))
        .map((m) => m.userId);
      if (recipientIds.length === 0) continue;
      recipientIds.forEach((id) => notified.add(id));
      await notifyMany(recipientIds, {
        type: 'NEW_POST',
        postId: params.postId,
        postTitle: params.postTitle,
        authorId: params.authorId,
        authorName: params.authorName,
        audience: 'community',
        communityId,
        communityName: nameById.get(communityId) ?? '',
      });
    }
  } catch (err) {
    console.error(
      `[notify:new-post] fan-out failed for post ${params.postId}:`,
      err,
    );
  }
}
