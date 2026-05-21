import type { NotificationEvent, PushPayload } from '@mayday/shared';
import { prisma } from '../config/database.js';
import {
  sendNewMessageEmail,
  sendCommunityJoinRequestEmail,
  sendCommunityJoinRequestApprovedEmail,
  sendCommunityInviteEmail,
  sendOrganizationInviteEmail,
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
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
}

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  isBanned: true,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
} as const;

const NOTIFY_CONCURRENCY = 5;

function buildPushPayload(event: NotificationEvent): PushPayload {
  switch (event.type) {
    case 'NEW_MESSAGE': {
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
        url: '/invites',
        tag: `inv:c:${event.communityId}`,
      };
    case 'ORGANIZATION_INVITE':
      return {
        title: `Invite to join ${event.organizationName}`,
        body: `${event.inviterName} invited you to join the organization.`,
        url: '/invites',
        tag: `inv:o:${event.organizationId}`,
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

// Time-sensitive events get high urgency so push services wake the device
// immediately instead of batching for power efficiency, plus a short TTL so
// stale messages aren't surfaced after the user is back in-app. Everything
// else uses library defaults (normal urgency, ~4-week TTL).
function buildPushOptions(event: NotificationEvent): PushSendOptions | undefined {
  if (event.type === 'NEW_MESSAGE') {
    return { urgency: 'high', TTL: 4 * 60 * 60 };
  }
  return undefined;
}

function sendEmailFor(
  user: RecipientPrefs,
  event: NotificationEvent,
): Promise<void> {
  switch (event.type) {
    case 'NEW_MESSAGE':
      return sendNewMessageEmail(user.email, event.senderName, event.content);
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

  const tasks: Array<{ channel: 'email' | 'push'; promise: Promise<unknown> }> = [];
  if (user.emailNotificationsEnabled) {
    tasks.push({ channel: 'email', promise: sendEmailFor(user, event) });
  }
  if (user.pushNotificationsEnabled) {
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
