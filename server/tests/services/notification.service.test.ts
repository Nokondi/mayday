import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationEvent } from '@mayday/shared';

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }));

const sendNewMessageEmail = vi.fn().mockResolvedValue(undefined);
const sendNewCommentEmail = vi.fn().mockResolvedValue(undefined);
const sendNewPostEmail = vi.fn().mockResolvedValue(undefined);
const sendCommunityJoinRequestEmail = vi.fn().mockResolvedValue(undefined);
const sendCommunityJoinRequestApprovedEmail = vi.fn().mockResolvedValue(undefined);
const sendCommunityInviteEmail = vi.fn().mockResolvedValue(undefined);
const sendOrganizationInviteEmail = vi.fn().mockResolvedValue(undefined);
const sendAnnouncementEmail = vi.fn().mockResolvedValue(undefined);
const sendBugReportAdminEmail = vi.fn().mockResolvedValue(undefined);
const sendUserReportAdminEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/mail.service.js', () => ({
  sendNewMessageEmail,
  sendNewCommentEmail,
  sendNewPostEmail,
  sendCommunityJoinRequestEmail,
  sendCommunityJoinRequestApprovedEmail,
  sendCommunityInviteEmail,
  sendOrganizationInviteEmail,
  sendAnnouncementEmail,
  sendBugReportAdminEmail,
  sendUserReportAdminEmail,
}));

const sendPushToUser = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/push.service.js', () => ({
  isPushConfigured: () => true,
  sendPushToUser,
}));

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
    },
  },
}));

interface UserOverrides {
  id?: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
  isBanned?: boolean;
  emailNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
}

function makeUser(overrides: UserOverrides = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    emailVerified: true,
    isBanned: false,
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: true,
    ...overrides,
  };
}

const NEW_MESSAGE_EVENT: NotificationEvent = {
  type: 'NEW_MESSAGE',
  senderName: 'Bob',
  senderId: 'user-2',
  conversationId: 'conv-1',
  content: 'Hello there',
};

const NEW_COMMENT_EVENT: NotificationEvent = {
  type: 'NEW_COMMENT',
  postId: 'post-1',
  postTitle: 'Need help moving',
  commenterId: 'user-2',
  commenterName: 'Bob',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notify — recipient gating', () => {
  it('does nothing when the user is not found', async () => {
    findUniqueMock.mockResolvedValue(null);
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('missing', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('skips banned users on both channels', async () => {
    findUniqueMock.mockResolvedValue(makeUser({ isBanned: true }));
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('skips unverified users on both channels', async () => {
    findUniqueMock.mockResolvedValue(makeUser({ emailVerified: false }));
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});

describe('notify — channel gating', () => {
  it('dispatches both channels when both prefs are on', async () => {
    findUniqueMock.mockResolvedValue(makeUser());
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
  });

  it('dispatches only email when push pref is off', async () => {
    findUniqueMock.mockResolvedValue(makeUser({ pushNotificationsEnabled: false }));
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('dispatches only push when email pref is off', async () => {
    findUniqueMock.mockResolvedValue(makeUser({ emailNotificationsEnabled: false }));
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendNewMessageEmail).not.toHaveBeenCalled();
  });

  it('dispatches neither channel when both prefs are off', async () => {
    findUniqueMock.mockResolvedValue(
      makeUser({ emailNotificationsEnabled: false, pushNotificationsEnabled: false }),
    );
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('runs channels independently — email failure does not skip push', async () => {
    findUniqueMock.mockResolvedValue(makeUser());
    sendNewMessageEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);

    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[notify:email\] NEW_MESSAGE failed/),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });

  it('runs channels independently — push failure does not skip email', async () => {
    findUniqueMock.mockResolvedValue(makeUser());
    sendPushToUser.mockRejectedValueOnce(new Error('VAPID error'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);

    expect(sendNewMessageEmail).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[notify:push\] NEW_MESSAGE failed/),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});

describe('notify — per-event email arguments', () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(makeUser());
  });

  it('NEW_MESSAGE → sendNewMessageEmail(email, senderName, content)', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    expect(sendNewMessageEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Hello there',
    );
  });

  it('NEW_MESSAGE — encrypted: sendNewMessageEmail is called with null preview (no content)', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      ...NEW_MESSAGE_EVENT,
      content: 'should-never-be-emailed',
      isEncrypted: true,
    });
    // Critical: the preview argument is `null`, not the content string.
    // mail.service renders the no-blockquote variant on null.
    expect(sendNewMessageEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      null,
    );
    const calls = sendNewMessageEmail.mock.calls as unknown as [string, string, string | null][];
    for (const args of calls) {
      expect(args[2]).not.toBe('should-never-be-emailed');
    }
  });

  it('NEW_COMMENT → sendNewCommentEmail(email, commenterName, postTitle, postId)', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_COMMENT_EVENT);
    expect(sendNewCommentEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Need help moving',
      'post-1',
    );
  });

  it('NEW_POST (friend) → sendNewPostEmail with null communityName', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: 'user-2',
      authorName: 'Bob',
      audience: 'friend',
    });
    expect(sendNewPostEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Need help moving',
      'post-1',
      null,
    );
  });

  it('NEW_POST (community) → sendNewPostEmail with the community name', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: 'user-2',
      authorName: 'Bob',
      audience: 'community',
      communityId: 'c-1',
      communityName: 'Coders',
    });
    expect(sendNewPostEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Need help moving',
      'post-1',
      'Coders',
    );
  });

  it('COMMUNITY_JOIN_REQUEST → sendCommunityJoinRequestEmail with all fields', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_JOIN_REQUEST',
      communityId: 'c-1',
      communityName: 'Coders',
      requesterName: 'Bob',
      message: 'Please?',
    });
    expect(sendCommunityJoinRequestEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Coders',
      'c-1',
      'Please?',
    );
  });

  it('COMMUNITY_JOIN_APPROVED → sendCommunityJoinRequestApprovedEmail', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_JOIN_APPROVED',
      communityId: 'c-1',
      communityName: 'Coders',
    });
    expect(sendCommunityJoinRequestApprovedEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Coders',
      'c-1',
    );
  });

  it('COMMUNITY_INVITE → sendCommunityInviteEmail', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_INVITE',
      communityId: 'c-1',
      communityName: 'Coders',
      inviterName: 'Bob',
    });
    expect(sendCommunityInviteEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Coders',
    );
  });

  it('ORGANIZATION_INVITE → sendOrganizationInviteEmail', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'ORGANIZATION_INVITE',
      organizationId: 'o-1',
      organizationName: 'Acme',
      inviterName: 'Bob',
    });
    expect(sendOrganizationInviteEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Bob',
      'Acme',
    );
  });

  it('ANNOUNCEMENT → sendAnnouncementEmail with the user’s name from the DB, not the event', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', { type: 'ANNOUNCEMENT', message: 'Hello world' });
    expect(sendAnnouncementEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Alice',
      'Hello world',
    );
  });

  it('BUG_REPORT_SUBMITTED → sendBugReportAdminEmail with reporter and title', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'BUG_REPORT_SUBMITTED',
      reportId: 'b1',
      reporterName: 'Carol',
      title: 'Crash on load',
    });
    expect(sendBugReportAdminEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Carol',
      'Crash on load',
    );
  });

  it('USER_REPORT_SUBMITTED → sendUserReportAdminEmail with the targetKind passed through', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'USER_REPORT_SUBMITTED',
      reportId: 'r1',
      reporterName: 'Carol',
      reason: 'Spam',
      targetKind: 'content',
    });
    expect(sendUserReportAdminEmail).toHaveBeenCalledWith(
      'alice@example.com',
      'Carol',
      'Spam',
      'content',
    );
  });
});

describe('notify — per-event push payloads', () => {
  beforeEach(() => {
    findUniqueMock.mockResolvedValue(makeUser());
  });

  function payloadOf() {
    return sendPushToUser.mock.calls[0]?.[1] as {
      title: string;
      body: string;
      url: string;
      tag?: string;
    };
  }

  it('NEW_MESSAGE — title names the sender, url=/messages, tag namespaced by conv', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_MESSAGE_EVENT);
    const p = payloadOf();
    expect(p.title).toBe('New message from Bob');
    expect(p.body).toBe('Hello there');
    expect(p.url).toBe('/messages');
    expect(p.tag).toBe('msg:conv-1');
  });

  it('NEW_MESSAGE — body is truncated past 200 chars with an ellipsis', async () => {
    const longContent = 'x'.repeat(250);
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', { ...NEW_MESSAGE_EVENT, content: longContent });
    const p = payloadOf();
    expect(p.body.length).toBe(201);
    expect(p.body.endsWith('…')).toBe(true);
  });

  it('NEW_MESSAGE — encrypted: body is empty, title and tag still set, content is NOT in the payload', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      ...NEW_MESSAGE_EVENT,
      content: 'should-never-appear-in-push',
      isEncrypted: true,
    });
    const p = payloadOf();
    expect(p.title).toBe('New message from Bob');
    expect(p.body).toBe('');
    expect(p.tag).toBe('msg:conv-1');
    // Defense in depth: even though content is the field name, no portion of
    // it should be serialized into the body. A regression where we accidentally
    // truncated rather than suppressed would still leak the first 200 chars.
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain('should-never-appear-in-push');
  });

  it('NEW_COMMENT — title names commenter and post, url=/posts/:id, tag namespaced by post', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', NEW_COMMENT_EVENT);
    const p = payloadOf();
    expect(p.title).toBe('Bob commented on "Need help moving"');
    expect(p.url).toBe('/posts/post-1');
    expect(p.tag).toBe('comment:post-1');
  });

  it('NEW_POST (friend) — title names the author, body is the post title, deep links to the post', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: 'user-2',
      authorName: 'Bob',
      audience: 'friend',
    });
    const p = payloadOf();
    expect(p.title).toBe('Bob shared a new post');
    expect(p.body).toBe('Need help moving');
    expect(p.url).toBe('/posts/post-1');
    expect(p.tag).toBe('post:post-1');
  });

  it('NEW_POST (community) — title names the community, body names the author', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: 'user-2',
      authorName: 'Bob',
      audience: 'community',
      communityId: 'c-1',
      communityName: 'Coders',
    });
    const p = payloadOf();
    expect(p.title).toBe('New post in Coders');
    expect(p.body).toBe('Bob: Need help moving');
    expect(p.url).toBe('/posts/post-1');
    expect(p.tag).toBe('post:post-1');
  });

  it('COMMUNITY_JOIN_REQUEST — url goes to /manage and body falls back when no message', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_JOIN_REQUEST',
      communityId: 'c-1',
      communityName: 'Coders',
      requesterName: 'Bob',
      message: null,
    });
    const p = payloadOf();
    expect(p.url).toBe('/communities/c-1/manage');
    expect(p.body).toBe('Tap to review the request.');
    expect(p.tag).toBe('cjr:c-1');
  });

  it('COMMUNITY_JOIN_APPROVED — deep links to the community', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_JOIN_APPROVED',
      communityId: 'c-1',
      communityName: 'Coders',
    });
    const p = payloadOf();
    expect(p.url).toBe('/communities/c-1');
    expect(p.tag).toBe('cja:c-1');
  });

  it('COMMUNITY_INVITE — deep links to /messages', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'COMMUNITY_INVITE',
      communityId: 'c-1',
      communityName: 'Coders',
      inviterName: 'Bob',
    });
    const p = payloadOf();
    // Invites now arrive as a message, so the push deep-links to the thread.
    expect(p.url).toBe('/messages');
    expect(p.tag).toBe('inv:c:c-1');
  });

  it('ORGANIZATION_INVITE — deep links to /messages', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'ORGANIZATION_INVITE',
      organizationId: 'o-1',
      organizationName: 'Acme',
      inviterName: 'Bob',
    });
    const p = payloadOf();
    // Invites now arrive as a message, so the push deep-links to the thread.
    expect(p.url).toBe('/messages');
    expect(p.tag).toBe('inv:o:o-1');
  });

  it('ANNOUNCEMENT — generic title + tag, url=/', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', { type: 'ANNOUNCEMENT', message: 'Heads up' });
    const p = payloadOf();
    expect(p.title).toBe('Announcement from Mayday');
    expect(p.body).toBe('Heads up');
    expect(p.url).toBe('/');
    expect(p.tag).toBe('announcement');
  });

  it('BUG_REPORT_SUBMITTED — links to /admin and tags by report id', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'BUG_REPORT_SUBMITTED',
      reportId: 'b1',
      reporterName: 'Carol',
      title: 'Crash on load',
    });
    const p = payloadOf();
    expect(p.title).toBe('New bug report from Carol');
    expect(p.body).toBe('Crash on load');
    expect(p.url).toBe('/admin');
    expect(p.tag).toBe('br:b1');
  });

  it('USER_REPORT_SUBMITTED — kind label varies by targetKind, url=/admin', async () => {
    const { notify } = await import('../../src/services/notification.service.js');
    await notify('user-1', {
      type: 'USER_REPORT_SUBMITTED',
      reportId: 'r1',
      reporterName: 'Carol',
      reason: 'Harassment',
      targetKind: 'user',
    });
    const userPayload = payloadOf();
    expect(userPayload.title).toBe('New user report from Carol');
    expect(userPayload.body).toBe('Harassment');
    expect(userPayload.url).toBe('/admin');
    expect(userPayload.tag).toBe('ur:r1');

    sendPushToUser.mockClear();
    await notify('user-1', {
      type: 'USER_REPORT_SUBMITTED',
      reportId: 'r2',
      reporterName: 'Carol',
      reason: 'Spam',
      targetKind: 'content',
    });
    const contentPayload = payloadOf();
    expect(contentPayload.title).toBe('New content report from Carol');
  });
});

describe('notifyAdmins', () => {
  it('queries users with role=ADMIN and excludes the given user', async () => {
    findManyMock.mockResolvedValue([]);
    const { notifyAdmins } = await import('../../src/services/notification.service.js');
    await notifyAdmins(
      {
        type: 'BUG_REPORT_SUBMITTED',
        reportId: 'b1',
        reporterName: 'Carol',
        title: 'x',
      },
      { excludeUserId: 'admin-self' },
    );

    expect(findManyMock).toHaveBeenCalledWith({
      where: { role: 'ADMIN', id: { not: 'admin-self' } },
      select: { id: true },
    });
  });

  it('omits the id filter when no excludeUserId is supplied', async () => {
    findManyMock.mockResolvedValue([]);
    const { notifyAdmins } = await import('../../src/services/notification.service.js');
    await notifyAdmins({
      type: 'BUG_REPORT_SUBMITTED',
      reportId: 'b1',
      reporterName: 'Carol',
      title: 'x',
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
  });

  it('fans out the event to every admin returned by the query', async () => {
    // First call is the role=ADMIN query; second is the recipient load inside notifyMany.
    findManyMock
      .mockResolvedValueOnce([{ id: 'admin-1' }, { id: 'admin-2' }])
      .mockResolvedValueOnce([
        makeUser({ id: 'admin-1', email: 'a1@x.com' }),
        makeUser({ id: 'admin-2', email: 'a2@x.com' }),
      ]);

    const { notifyAdmins } = await import('../../src/services/notification.service.js');
    await notifyAdmins({
      type: 'BUG_REPORT_SUBMITTED',
      reportId: 'b1',
      reporterName: 'Carol',
      title: 'Crash on load',
    });

    expect(sendBugReportAdminEmail).toHaveBeenCalledTimes(2);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });

  it('swallows database errors so the caller is not broken', async () => {
    findManyMock.mockRejectedValueOnce(new Error('db down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notifyAdmins } = await import('../../src/services/notification.service.js');
    await expect(
      notifyAdmins({
        type: 'BUG_REPORT_SUBMITTED',
        reportId: 'b1',
        reporterName: 'Carol',
        title: 'x',
      }),
    ).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[notify:admins\] BUG_REPORT_SUBMITTED failed/),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});

describe('notifyMany', () => {
  it('returns immediately on an empty list (no DB query)', async () => {
    const { notifyMany } = await import('../../src/services/notification.service.js');
    await notifyMany([], { type: 'ANNOUNCEMENT', message: 'x' });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('loads recipients in a single query and dispatches per user', async () => {
    findManyMock.mockResolvedValue([
      makeUser({ id: 'u1', email: 'a@x.com' }),
      makeUser({ id: 'u2', email: 'b@x.com' }),
      makeUser({ id: 'u3', email: 'c@x.com', pushNotificationsEnabled: false }),
    ]);

    const { notifyMany } = await import('../../src/services/notification.service.js');
    await notifyMany(['u1', 'u2', 'u3'], {
      type: 'ANNOUNCEMENT',
      message: 'Hi',
    });

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'u2', 'u3'] } },
      select: expect.any(Object),
    });
    // u1, u2 get both channels; u3 gets email only.
    expect(sendAnnouncementEmail).toHaveBeenCalledTimes(3);
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });

  it('continues past per-user dispatch failures', async () => {
    findManyMock.mockResolvedValue([
      makeUser({ id: 'u1' }),
      makeUser({ id: 'u2' }),
    ]);
    sendAnnouncementEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { notifyMany } = await import('../../src/services/notification.service.js');
    await notifyMany(['u1', 'u2'], { type: 'ANNOUNCEMENT', message: 'Hi' });

    expect(sendAnnouncementEmail).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });
});
