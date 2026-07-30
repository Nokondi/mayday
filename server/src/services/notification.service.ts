import type { NotificationCategory, NotificationEvent, PushPayload } from '@mayday/shared';
import { prisma } from '../config/database.js';
import {
  sendNewMessageEmail,
  sendNewCommentEmail,
  sendNewPostEmail,
  sendPostDigestEmail,
  sendCommunityJoinRequestEmail,
  sendCommunityJoinRequestApprovedEmail,
  sendCommunityInviteEmail,
  sendOrganizationInviteEmail,
  sendFriendRequestEmail,
  sendFriendRequestAcceptedEmail,
  sendAnnouncementEmail,
  sendBugReportAdminEmail,
  sendUserReportAdminEmail,
} from './mail.service.js';
import { sendPushToUser, type PushSendOptions } from './push.service.js';

interface RecipientPrefs {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isBanned: boolean;
  pushNotificationsEnabled: boolean;
  mutedEmailCategories: NotificationCategory[];
  mutedPushCategories: NotificationCategory[];
}

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  isBanned: true,
  pushNotificationsEnabled: true,
  mutedEmailCategories: true,
  mutedPushCategories: true,
} as const;

/**
 * The muting categories an event belongs to, or null for admin operational
 * notifications (bug/user reports), which cannot be muted per-category.
 * Most events map to exactly one category; the weekly digest spans both post
 * audiences, so it delivers on a channel while EITHER audience is unmuted
 * there (a fully-muted audience is already excluded from the digest's
 * contents by postDigest.service).
 */
function categoriesOf(event: NotificationEvent): NotificationCategory[] | null {
  switch (event.type) {
    case 'COMMUNITY_INVITE':
    case 'ORGANIZATION_INVITE':
      return ['INVITES'];
    case 'COMMUNITY_JOIN_REQUEST':
    case 'COMMUNITY_JOIN_APPROVED':
      return ['JOIN_REQUESTS'];
    case 'NEW_MESSAGE':
      return ['MESSAGES'];
    case 'NEW_COMMENT':
      return ['COMMENTS'];
    case 'NEW_POST':
      return event.audience === 'community' ? ['COMMUNITY_POSTS'] : ['FRIEND_POSTS'];
    case 'POST_DIGEST':
      return ['FRIEND_POSTS', 'COMMUNITY_POSTS'];
    case 'FRIEND_REQUEST':
    case 'FRIEND_REQUEST_ACCEPTED':
      return ['FRIEND_REQUESTS'];
    case 'ANNOUNCEMENT':
      return ['ANNOUNCEMENTS'];
    case 'BUG_REPORT_SUBMITTED':
    case 'USER_REPORT_SUBMITTED':
      return null;
  }
}

const NOTIFY_CONCURRENCY = 5;

function buildPushPayload(event: NotificationEvent): PushPayload {
  switch (event.type) {
    case 'NEW_MESSAGE': {
      // E2EE: when the message was sent encrypted, never put any preview
      // text in the push body — the push provider sees the payload, and we
      // promised it wouldn't be able to read message content. The sender
      // name is fine (metadata) and the title alone is enough context for
      // the user to tap through.
      if (event.isEncrypted) {
        return {
          title: `New message from ${event.senderName}`,
          body: '',
          url: '/messages',
          tag: `msg:${event.conversationId}`,
        };
      }
      const preview =
        event.content.length > 200
          ? event.content.slice(0, 200) + '…'
          : event.content;
      return {
        title: `New message from ${event.senderName}`,
        body: preview,
        url: '/messages',
        tag: `msg:${event.conversationId}`,
      };
    }
    case 'NEW_COMMENT':
      return {
        title: `${event.commenterName} commented on "${event.postTitle}"`,
        body: 'Tap to view the discussion.',
        url: `/posts/${event.postId}`,
        tag: `comment:${event.postId}`,
      };
    case 'NEW_POST':
      if (event.audience === 'community') {
        return {
          title: `New post in ${event.communityName}`,
          body: `${event.authorName}: ${event.postTitle}`,
          url: `/posts/${event.postId}`,
          tag: `post:${event.postId}`,
        };
      }
      return {
        title: `${event.authorName} shared a new post`,
        body: event.postTitle,
        url: `/posts/${event.postId}`,
        tag: `post:${event.postId}`,
      };
    case 'POST_DIGEST': {
      const label = event.count === 1 ? 'post' : 'posts';
      return {
        title: 'Your weekly Mayday digest',
        body: `${event.count} new ${label} from your friends and communities.`,
        url: '/',
        tag: 'post-digest',
      };
    }
    case 'COMMUNITY_JOIN_REQUEST':
      return {
        title: `${event.requesterName} wants to join ${event.communityName}`,
        body: event.message ?? 'Tap to review the request.',
        url: `/communities/${event.communityId}/manage`,
        tag: `cjr:${event.communityId}`,
      };
    case 'COMMUNITY_JOIN_APPROVED':
      return {
        title: `You're in: ${event.communityName}`,
        body: `Your request to join "${event.communityName}" was approved.`,
        url: `/communities/${event.communityId}`,
        tag: `cja:${event.communityId}`,
      };
    case 'COMMUNITY_INVITE':
      return {
        title: `Invite to join ${event.communityName}`,
        body: `${event.inviterName} invited you to join the community.`,
        url: '/messages',
        tag: `inv:c:${event.communityId}`,
      };
    case 'ORGANIZATION_INVITE':
      return {
        title: `Invite to join ${event.organizationName}`,
        body: `${event.inviterName} invited you to join the organization.`,
        url: '/messages',
        tag: `inv:o:${event.organizationId}`,
      };
    case 'FRIEND_REQUEST':
      return {
        title: `${event.senderName} sent you a friend request`,
        body: 'Tap to accept or decline.',
        url: '/messages',
        tag: `friend:req:${event.senderId}`,
      };
    case 'FRIEND_REQUEST_ACCEPTED':
      return {
        title: `${event.accepterName} accepted your friend request`,
        body: `You and ${event.accepterName} are now friends.`,
        url: `/profile/${event.accepterId}`,
        tag: `friend:acc:${event.accepterId}`,
      };
    case 'ANNOUNCEMENT':
      return {
        title: 'Announcement from Mayday',
        body: event.message,
        url: '/',
        tag: 'announcement',
      };
    case 'BUG_REPORT_SUBMITTED':
      return {
        title: `New bug report from ${event.reporterName}`,
        body: event.title,
        url: '/admin',
        tag: `br:${event.reportId}`,
      };
    case 'USER_REPORT_SUBMITTED': {
      const kindLabel = event.targetKind === 'user' ? 'user report' : 'content report';
      return {
        title: `New ${kindLabel} from ${event.reporterName}`,
        body: event.reason,
        url: '/admin',
        tag: `ur:${event.reportId}`,
      };
    }
  }
}

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

// Every user-facing event is something a person is actively waiting on, so
// they all get high urgency — push services (FCM/Mozilla) treat the default
// 'normal' as batchable and can hold delivery until the device next wakes,
// which reads as "delayed or missing" notifications. TTLs cap staleness:
// a message push is pointless hours later; everything else keeps for a day.
// The weekly digest is the one genuinely non-urgent push — let the service
// batch it for power efficiency.
function buildPushOptions(event: NotificationEvent): PushSendOptions {
  switch (event.type) {
    case 'NEW_MESSAGE':
      return { urgency: 'high', TTL: 4 * HOUR };
    case 'POST_DIGEST':
      return { urgency: 'normal', TTL: DAY };
    default:
      return { urgency: 'high', TTL: DAY };
  }
}

function sendEmailFor(
  user: RecipientPrefs,
  event: NotificationEvent,
): Promise<void> {
  switch (event.type) {
    case 'NEW_MESSAGE':
      // Pass null preview for encrypted sends so the email renders without
      // the blockquote. Same privacy goal as the push body suppression above.
      return sendNewMessageEmail(
        user.email,
        event.senderName,
        event.isEncrypted ? null : event.content,
      );
    case 'NEW_COMMENT':
      return sendNewCommentEmail(
        user.email,
        event.commenterName,
        event.postTitle,
        event.postId,
      );
    case 'NEW_POST':
      return sendNewPostEmail(
        user.email,
        event.authorName,
        event.postTitle,
        event.postId,
        event.audience === 'community' ? event.communityName ?? null : null,
      );
    case 'POST_DIGEST':
      return sendPostDigestEmail(
        user.email,
        user.name,
        event.count,
        event.posts,
      );
    case 'COMMUNITY_JOIN_REQUEST':
      return sendCommunityJoinRequestEmail(
        user.email,
        event.requesterName,
        event.communityName,
        event.communityId,
        event.message,
      );
    case 'COMMUNITY_JOIN_APPROVED':
      return sendCommunityJoinRequestApprovedEmail(
        user.email,
        event.communityName,
        event.communityId,
      );
    case 'COMMUNITY_INVITE':
      return sendCommunityInviteEmail(
        user.email,
        event.inviterName,
        event.communityName,
      );
    case 'ORGANIZATION_INVITE':
      return sendOrganizationInviteEmail(
        user.email,
        event.inviterName,
        event.organizationName,
      );
    case 'FRIEND_REQUEST':
      return sendFriendRequestEmail(user.email, event.senderName);
    case 'FRIEND_REQUEST_ACCEPTED':
      return sendFriendRequestAcceptedEmail(
        user.email,
        event.accepterName,
        event.accepterId,
      );
    case 'ANNOUNCEMENT':
      return sendAnnouncementEmail(user.email, user.name, event.message);
    case 'BUG_REPORT_SUBMITTED':
      return sendBugReportAdminEmail(user.email, event.reporterName, event.title);
    case 'USER_REPORT_SUBMITTED':
      return sendUserReportAdminEmail(
        user.email,
        event.reporterName,
        event.reason,
        event.targetKind,
      );
  }
}

async function dispatch(
  user: RecipientPrefs,
  event: NotificationEvent,
): Promise<void> {
  if (user.isBanned) return;
  if (!user.emailVerified) return;

  // Per-category muting: null categories (admin ops) can't be muted; a
  // channel is allowed while ANY of the event's categories is unmuted there.
  // Push is additionally gated by the device-level master pref.
  const categories = categoriesOf(event);
  const emailAllowed =
    categories === null ||
    categories.some((c) => !user.mutedEmailCategories.includes(c));
  const pushAllowed =
    user.pushNotificationsEnabled &&
    (categories === null ||
      categories.some((c) => !user.mutedPushCategories.includes(c)));

  const tasks: Array<{ channel: 'email' | 'push'; promise: Promise<unknown> }> = [];
  if (emailAllowed) {
    tasks.push({ channel: 'email', promise: sendEmailFor(user, event) });
  }
  if (pushAllowed) {
    tasks.push({
      channel: 'push',
      promise: sendPushToUser(
        user.id,
        buildPushPayload(event),
        buildPushOptions(event),
      ),
    });
  }

  const results = await Promise.allSettled(tasks.map((t) => t.promise));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const channel = tasks[i]!.channel;
      console.error(
        `[notify:${channel}] ${event.type} failed for user ${user.id}:`,
        result.reason,
      );
    }
  });
}

export async function notify(
  userId: string,
  event: NotificationEvent,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: RECIPIENT_SELECT,
  });
  if (!user) return;
  await dispatch(user, event);
}

export async function notifyMany(
  userIds: string[],
  event: NotificationEvent,
): Promise<void> {
  if (userIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: RECIPIENT_SELECT,
  });

  for (let i = 0; i < users.length; i += NOTIFY_CONCURRENCY) {
    const batch = users.slice(i, i + NOTIFY_CONCURRENCY);
    await Promise.allSettled(batch.map((u) => dispatch(u, event)));
  }
}

// Fan out a notification to every site admin. Swallows errors so notification
// failures never break the originating mutation (e.g. a bug-report submission).
export async function notifyAdmins(
  event: NotificationEvent,
  options: { excludeUserId?: string } = {},
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      },
      select: { id: true },
    });
    await notifyMany(admins.map((a) => a.id), event);
  } catch (err) {
    console.error(`[notify:admins] ${event.type} failed:`, err);
  }
}
