import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findMany: vi.fn(), update: vi.fn() },
    communityMember: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

vi.mock('../../src/services/friend.service.js', () => ({
  getFriendIds: vi.fn(),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notify: vi.fn(),
}));

import { prisma } from '../../src/config/database.js';
import { getFriendIds as getFriendIdsFn } from '../../src/services/friend.service.js';
import { notify as notifyFn } from '../../src/services/notification.service.js';
import { runPostDigestSweep } from '../../src/services/postDigest.service.js';

const userFindMany = vi.mocked(prisma.user.findMany);
const userUpdate = vi.mocked(prisma.user.update);
const communityMemberFindMany = vi.mocked(prisma.communityMember.findMany);
const postFindMany = vi.mocked(prisma.post.findMany);
const getFriendIds = vi.mocked(getFriendIdsFn);
const notify = vi.mocked(notifyFn);

const NOW = new Date('2026-07-28T12:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function digestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    notifyFriendPosts: true,
    notifyCommunityPosts: true,
    minPostNotificationUrgency: 'LOW',
    lastPostDigestAt: null,
    ...overrides,
  };
}

function dbPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: 'Need help moving',
    author: { name: 'Alice' },
    communities: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindMany.mockResolvedValue([] as never);
  userUpdate.mockResolvedValue({} as never);
  communityMemberFindMany.mockResolvedValue([] as never);
  postFindMany.mockResolvedValue([] as never);
  getFriendIds.mockResolvedValue([]);
  notify.mockResolvedValue(undefined);
});

describe('runPostDigestSweep — due-user selection', () => {
  it('selects verified, unbanned WEEKLY users whose digest is a week old or never sent', async () => {
    await runPostDigestSweep(NOW);

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        postNotificationFrequency: 'WEEKLY',
        isBanned: false,
        emailVerified: true,
        OR: [
          { lastPostDigestAt: null },
          { lastPostDigestAt: { lte: new Date(NOW.getTime() - WEEK_MS) } },
        ],
      },
      select: {
        id: true,
        notifyFriendPosts: true,
        notifyCommunityPosts: true,
        minPostNotificationUrgency: true,
        lastPostDigestAt: true,
      },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('runPostDigestSweep — digest contents', () => {
  it('sends a POST_DIGEST with community attribution and advances lastPostDigestAt', async () => {
    userFindMany.mockResolvedValue([digestUser()] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);
    getFriendIds.mockResolvedValue(['f1']);
    postFindMany.mockResolvedValue([
      dbPost({
        id: 'p1',
        communities: [{ community: { id: 'c1', name: 'Coders' } }],
      }),
      dbPost({ id: 'p2', title: 'Free sofa', author: { name: 'Bob' } }),
    ] as never);

    await runPostDigestSweep(NOW);

    expect(notify).toHaveBeenCalledWith('u1', {
      type: 'POST_DIGEST',
      count: 2,
      posts: [
        { id: 'p1', title: 'Need help moving', authorName: 'Alice', communityName: 'Coders' },
        { id: 'p2', title: 'Free sofa', authorName: 'Bob', communityName: null },
      ],
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lastPostDigestAt: NOW },
    });
  });

  it('does not attribute a post to a community the recipient is not an (unmuted) member of', async () => {
    userFindMany.mockResolvedValue([digestUser()] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);
    getFriendIds.mockResolvedValue(['f1']);
    // A friend's post scoped to some other community the user isn't in.
    postFindMany.mockResolvedValue([
      dbPost({
        communities: [{ community: { id: 'c-other', name: 'Elsewhere' } }],
      }),
    ] as never);

    await runPostDigestSweep(NOW);

    const event = notify.mock.calls[0]?.[1] as { posts: Array<{ communityName: string | null }> };
    expect(event.posts[0]?.communityName).toBeNull();
  });

  it('queries posts since lastPostDigestAt with the urgency floor applied', async () => {
    const last = new Date('2026-07-20T12:00:00Z');
    userFindMany.mockResolvedValue([
      digestUser({ minPostNotificationUrgency: 'HIGH', lastPostDigestAt: last }),
    ] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);

    await runPostDigestSweep(NOW);

    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: last },
          authorId: { not: 'u1' },
          urgency: { in: ['HIGH', 'CRITICAL'] },
        }),
      }),
    );
  });

  it('includes only unmuted communities and visible friend posts in the audience', async () => {
    userFindMany.mockResolvedValue([digestUser()] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);
    getFriendIds.mockResolvedValue(['f1']);

    await runPostDigestSweep(NOW);

    expect(communityMemberFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1', notifyNewPosts: true },
      select: { communityId: true },
    });
    const where = (postFindMany.mock.calls[0] as [{ where: { OR: unknown[] } }])[0].where;
    expect(where.OR).toEqual([
      { communities: { some: { communityId: { in: ['c1'] } } } },
      {
        authorId: { in: ['f1'] },
        OR: [{ sharedWithFriends: true }, { communities: { none: {} } }],
      },
    ]);
  });

  it('skips the community branch when notifyCommunityPosts is off', async () => {
    userFindMany.mockResolvedValue([
      digestUser({ notifyCommunityPosts: false }),
    ] as never);
    getFriendIds.mockResolvedValue(['f1']);

    await runPostDigestSweep(NOW);

    expect(communityMemberFindMany).not.toHaveBeenCalled();
    const where = (postFindMany.mock.calls[0] as [{ where: { OR: unknown[] } }])[0].where;
    expect(where.OR).toHaveLength(1);
  });

  it('sends nothing but still advances the window when there is no audience at all', async () => {
    userFindMany.mockResolvedValue([
      digestUser({ notifyFriendPosts: false, notifyCommunityPosts: false }),
    ] as never);

    await runPostDigestSweep(NOW);

    expect(postFindMany).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lastPostDigestAt: NOW },
    });
  });

  it('sends nothing but still advances the window when the week had no posts', async () => {
    userFindMany.mockResolvedValue([digestUser()] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);
    postFindMany.mockResolvedValue([] as never);

    await runPostDigestSweep(NOW);

    expect(notify).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('runPostDigestSweep — resilience', () => {
  it('a failing user does not block the rest of the sweep, and their window is not advanced', async () => {
    userFindMany.mockResolvedValue([
      digestUser({ id: 'u1' }),
      digestUser({ id: 'u2' }),
    ] as never);
    communityMemberFindMany.mockResolvedValue([{ communityId: 'c1' }] as never);
    postFindMany
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([dbPost()] as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runPostDigestSweep(NOW);

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[post-digest\] failed for user u1/),
      expect.any(Error),
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('u2', expect.anything());
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u2' } }),
    );
    errSpy.mockRestore();
  });

  it('swallows a failing due-user query entirely', async () => {
    userFindMany.mockRejectedValueOnce(new Error('db down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runPostDigestSweep(NOW)).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[post-digest\] sweep failed/),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});
