import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    community: { findMany: vi.fn() },
    communityMember: { findMany: vi.fn() },
  },
}));

vi.mock('../../src/services/friend.service.js', () => ({
  getFriendIds: vi.fn(),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notifyMany: vi.fn(),
}));

import { prisma } from '../../src/config/database.js';
import { getFriendIds as getFriendIdsFn } from '../../src/services/friend.service.js';
import { notifyMany as notifyManyFn } from '../../src/services/notification.service.js';
import { notifyNewPost } from '../../src/services/postNotification.service.js';

const userFindMany = vi.mocked(prisma.user.findMany);
const communityFindMany = vi.mocked(prisma.community.findMany);
const communityMemberFindMany = vi.mocked(prisma.communityMember.findMany);
const getFriendIds = vi.mocked(getFriendIdsFn);
const notifyMany = vi.mocked(notifyManyFn);

const AUTHOR_ID = 'author-1';

function baseParams(overrides: Partial<Parameters<typeof notifyNewPost>[0]> = {}) {
  return {
    postId: 'post-1',
    postTitle: 'Need help moving',
    urgency: 'MEDIUM' as const,
    authorId: AUTHOR_ID,
    authorName: 'Alice',
    sharedWithFriends: false,
    communityIds: [] as string[],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getFriendIds.mockResolvedValue([]);
  userFindMany.mockResolvedValue([]);
  communityFindMany.mockResolvedValue([]);
  communityMemberFindMany.mockResolvedValue([]);
});

describe('notifyNewPost — friend audience', () => {
  it('notifies opted-in friends of a public post with a friend-audience event', async () => {
    getFriendIds.mockResolvedValue(['f1', 'f2']);
    userFindMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);

    await notifyNewPost(baseParams());

    expect(notifyMany).toHaveBeenCalledTimes(1);
    expect(notifyMany).toHaveBeenCalledWith(['f1', 'f2'], {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: AUTHOR_ID,
      authorName: 'Alice',
      audience: 'friend',
    });
  });

  it('filters friends by opt-in and by minimum-urgency preference in the query', async () => {
    getFriendIds.mockResolvedValue(['f1']);
    userFindMany.mockResolvedValue([]);

    await notifyNewPost(baseParams({ urgency: 'MEDIUM' }));

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['f1'] },
        notifyFriendPosts: true,
        minPostNotificationUrgency: { in: ['LOW', 'MEDIUM'] },
        postNotificationFrequency: 'IMMEDIATE',
      },
      select: { id: true },
    });
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it('a CRITICAL post satisfies every minimum-urgency preference', async () => {
    getFriendIds.mockResolvedValue(['f1']);
    userFindMany.mockResolvedValue([{ id: 'f1' }]);

    await notifyNewPost(baseParams({ urgency: 'CRITICAL' }));

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          minPostNotificationUrgency: { in: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        }),
      }),
    );
  });

  it('notifies friends of a friends-shared post even when it is also community-scoped', async () => {
    getFriendIds.mockResolvedValue(['f1']);
    userFindMany.mockResolvedValue([{ id: 'f1' }]);
    communityFindMany.mockResolvedValue([{ id: 'c1', name: 'Coders' }]);
    communityMemberFindMany.mockResolvedValue([]);

    await notifyNewPost(
      baseParams({ sharedWithFriends: true, communityIds: ['c1'] }),
    );

    expect(notifyMany).toHaveBeenCalledWith(
      ['f1'],
      expect.objectContaining({ audience: 'friend' }),
    );
  });

  it('does NOT notify friends of a community-only post they may not be able to view', async () => {
    getFriendIds.mockResolvedValue(['f1']);
    communityFindMany.mockResolvedValue([{ id: 'c1', name: 'Coders' }]);
    communityMemberFindMany.mockResolvedValue([]);

    await notifyNewPost(baseParams({ communityIds: ['c1'] }));

    expect(getFriendIds).not.toHaveBeenCalled();
    expect(userFindMany).not.toHaveBeenCalled();
  });
});

describe('notifyNewPost — community audience', () => {
  it('notifies opted-in members of each attached community, excluding the author', async () => {
    communityFindMany.mockResolvedValue([{ id: 'c1', name: 'Coders' }]);
    communityMemberFindMany.mockResolvedValue([
      { userId: 'm1', communityId: 'c1' },
      { userId: 'm2', communityId: 'c1' },
    ]);

    await notifyNewPost(baseParams({ communityIds: ['c1'] }));

    expect(communityMemberFindMany).toHaveBeenCalledWith({
      where: {
        communityId: { in: ['c1'] },
        userId: { not: AUTHOR_ID },
        notifyNewPosts: true,
        user: {
          notifyCommunityPosts: true,
          minPostNotificationUrgency: { in: ['LOW', 'MEDIUM'] },
          postNotificationFrequency: 'IMMEDIATE',
        },
      },
      select: { userId: true, communityId: true },
    });
    expect(notifyMany).toHaveBeenCalledTimes(1);
    expect(notifyMany).toHaveBeenCalledWith(['m1', 'm2'], {
      type: 'NEW_POST',
      postId: 'post-1',
      postTitle: 'Need help moving',
      authorId: AUTHOR_ID,
      authorName: 'Alice',
      audience: 'community',
      communityId: 'c1',
      communityName: 'Coders',
    });
  });

  it('notifies a member of several attached communities only once, under the first', async () => {
    communityFindMany.mockResolvedValue([
      { id: 'c1', name: 'Coders' },
      { id: 'c2', name: 'Gardeners' },
    ]);
    communityMemberFindMany.mockResolvedValue([
      { userId: 'm1', communityId: 'c1' },
      { userId: 'm1', communityId: 'c2' },
      { userId: 'm2', communityId: 'c2' },
    ]);

    await notifyNewPost(baseParams({ communityIds: ['c1', 'c2'] }));

    expect(notifyMany).toHaveBeenCalledTimes(2);
    expect(notifyMany).toHaveBeenNthCalledWith(
      1,
      ['m1'],
      expect.objectContaining({ communityId: 'c1', communityName: 'Coders' }),
    );
    expect(notifyMany).toHaveBeenNthCalledWith(
      2,
      ['m2'],
      expect.objectContaining({ communityId: 'c2', communityName: 'Gardeners' }),
    );
  });

  it('does not re-notify a community member who already got the friend notification', async () => {
    getFriendIds.mockResolvedValue(['m1']);
    userFindMany.mockResolvedValue([{ id: 'm1' }]);
    communityFindMany.mockResolvedValue([{ id: 'c1', name: 'Coders' }]);
    communityMemberFindMany.mockResolvedValue([
      { userId: 'm1', communityId: 'c1' },
      { userId: 'm2', communityId: 'c1' },
    ]);

    await notifyNewPost(
      baseParams({ sharedWithFriends: true, communityIds: ['c1'] }),
    );

    expect(notifyMany).toHaveBeenCalledTimes(2);
    expect(notifyMany).toHaveBeenNthCalledWith(
      1,
      ['m1'],
      expect.objectContaining({ audience: 'friend' }),
    );
    expect(notifyMany).toHaveBeenNthCalledWith(
      2,
      ['m2'],
      expect.objectContaining({ audience: 'community' }),
    );
  });

  it('sends nothing when no one is opted in', async () => {
    communityFindMany.mockResolvedValue([{ id: 'c1', name: 'Coders' }]);
    communityMemberFindMany.mockResolvedValue([]);

    await notifyNewPost(baseParams({ communityIds: ['c1'] }));

    expect(notifyMany).not.toHaveBeenCalled();
  });
});

describe('notifyNewPost — resilience', () => {
  it('swallows errors so the post write is never broken', async () => {
    getFriendIds.mockRejectedValueOnce(new Error('db down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifyNewPost(baseParams())).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[notify:new-post\] fan-out failed for post post-1/),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});
