import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const prisma: Record<string, unknown> = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    postFulfillment: { count: vi.fn() },
    community: {
      delete: vi.fn(),
    },
    communityMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    communityInvite: {
      deleteMany: vi.fn(),
    },
    organization: {
      delete: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    organizationInvite: {
      deleteMany: vi.fn(),
    },
    message: {
      deleteMany: vi.fn(),
    },
    conversation: {
      deleteMany: vi.fn(),
    },
    report: {
      deleteMany: vi.fn(),
    },
    bugReport: {
      deleteMany: vi.fn(),
    },
    // Invoke the callback form synchronously with the same prisma mock as `tx`.
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
  return { prisma };
});

vi.mock('../../src/config/storage.js', () => ({
  deleteObjectByUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/middleware/upload.middleware.js', () => ({
  uploadAvatar: (req: { file?: unknown }, _res: unknown, next: () => void) => {
    req.file = { location: 'https://cdn.example.com/new-avatar.png' };
    next();
  },
  uploadPostImages: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { userRoutes } from '../../src/routes/user.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedUser = vi.mocked(prisma.user);
const mockedPost = vi.mocked(prisma.post);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = (id = USER_ID) =>
  `Bearer ${signAccessToken({ id, email: 'a@b.com', role: 'USER' })}`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.communityMember.findMany).mockResolvedValue([] as never);
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/users/:id', () => {
  it('returns a public user profile (no auth required)', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      id: USER_ID, name: 'Alice', bio: null, location: null, skills: [], avatarUrl: null,
      createdAt: new Date('2026-01-01'),
    } as never);

    const res = await request(makeApp()).get(`/api/users/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(USER_ID);
    expect(mockedUser.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: USER_ID },
      select: expect.not.objectContaining({ email: expect.anything(), passwordHash: expect.anything() }),
    }));
  });

  it('returns 404 when not found', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp()).get(`/api/users/${USER_ID}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/users/:id', () => {
  it('updates the caller\'s own profile', async () => {
    mockedUser.update.mockResolvedValueOnce({
      id: USER_ID, email: 'a@b.com', name: 'New Name', bio: 'hi', role: 'USER',
    } as never);

    const res = await request(makeApp())
      .put(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'New Name', bio: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('forbids editing another user', async () => {
    const res = await request(makeApp())
      .put(`/api/users/${OTHER_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Hacker' });
    expect(res.status).toBe(403);
    expect(mockedUser.update).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).put(`/api/users/${USER_ID}`).send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('validates the body', async () => {
    const res = await request(makeApp())
      .put(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader())
      .send({ name: '' }); // min(1)
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/:id/avatar', () => {
  it('updates avatar and deletes the old object', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({ avatarUrl: 'https://cdn.example.com/old.png' } as never);
    mockedUser.update.mockResolvedValueOnce({
      id: USER_ID, name: 'Alice', avatarUrl: 'https://cdn.example.com/new-avatar.png',
      bio: null, location: null, skills: [], createdAt: new Date('2026-01-01'),
    } as never);

    const res = await request(makeApp())
      .post(`/api/users/${USER_ID}/avatar`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://cdn.example.com/new-avatar.png');
    const { deleteObjectByUrl } = await import('../../src/config/storage.js');
    expect(deleteObjectByUrl).toHaveBeenCalledWith('https://cdn.example.com/old.png');
  });

  it('does not call storage when there was no previous avatar', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({ avatarUrl: null } as never);
    mockedUser.update.mockResolvedValueOnce({
      id: USER_ID, name: 'A', avatarUrl: 'https://cdn.example.com/new-avatar.png',
      bio: null, location: null, skills: [], createdAt: new Date('2026-01-01'),
    } as never);

    await request(makeApp())
      .post(`/api/users/${USER_ID}/avatar`)
      .set('Authorization', authHeader());

    const { deleteObjectByUrl } = await import('../../src/config/storage.js');
    expect(deleteObjectByUrl).not.toHaveBeenCalled();
  });

  it('forbids updating another user\'s avatar', async () => {
    const res = await request(makeApp())
      .post(`/api/users/${OTHER_ID}/avatar`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/:id/posts', () => {
  it('returns a user\'s posts with pagination meta', async () => {
    mockedPost.findMany.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }] as never);
    mockedPost.count.mockResolvedValueOnce(2 as never);

    const res = await request(makeApp())
      .get(`/api/users/${USER_ID}/posts`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [{ id: 'p1' }, { id: 'p2' }], total: 2, page: 1 });
  });

  it('clamps limit at 50', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get(`/api/users/${USER_ID}/posts?limit=999`)
      .set('Authorization', authHeader());

    const args = mockedPost.findMany.mock.calls[0][0] as { take: number };
    expect(args.take).toBe(50);
  });
});

describe('DELETE /api/users/:id', () => {
  const mockedCommunityMember = vi.mocked(prisma.communityMember);
  const mockedCommunity = vi.mocked(prisma.community);
  const mockedOrganizationMember = vi.mocked(prisma.organizationMember);
  const mockedOrganization = vi.mocked(prisma.organization);
  const mockedMessage = vi.mocked(prisma.message);
  const mockedConversation = vi.mocked(prisma.conversation);
  const mockedReport = vi.mocked(prisma.report);
  const mockedBugReport = vi.mocked(prisma.bugReport);
  const mockedOrgInvite = vi.mocked(prisma.organizationInvite);
  const mockedCommInvite = vi.mocked(prisma.communityInvite);

  function mockNoOwnedGroups() {
    mockedCommunityMember.findMany.mockResolvedValueOnce([] as never);
    mockedOrganizationMember.findMany.mockResolvedValueOnce([] as never);
  }

  function mockNoAvatar() {
    mockedUser.findUnique.mockResolvedValueOnce({ avatarUrl: null } as never);
  }

  it('forbids deleting another user', async () => {
    const res = await request(makeApp())
      .delete(`/api/users/${OTHER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
    expect(mockedUser.delete).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).delete(`/api/users/${USER_ID}`);
    expect(res.status).toBe(401);
  });

  it('tears down restricted-FK dependents and deletes the user on happy path', async () => {
    mockNoAvatar();
    mockNoOwnedGroups();

    const res = await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    // The cleanup happened in the right order (no transactional side-effect left undone).
    expect(mockedMessage.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ senderId: USER_ID }, { receiverId: USER_ID }] },
    });
    expect(mockedConversation.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ participantAId: USER_ID }, { participantBId: USER_ID }] },
    });
    expect(mockedPost.deleteMany).toHaveBeenCalledWith({ where: { authorId: USER_ID } });
    expect(mockedReport.deleteMany).toHaveBeenCalledWith({ where: { reporterId: USER_ID } });
    expect(mockedBugReport.deleteMany).toHaveBeenCalledWith({ where: { reporterId: USER_ID } });
    expect(mockedOrgInvite.deleteMany).toHaveBeenCalledWith({ where: { invitedById: USER_ID } });
    expect(mockedCommInvite.deleteMany).toHaveBeenCalledWith({ where: { invitedById: USER_ID } });
    expect(mockedUser.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it('clears the refreshToken cookie on successful delete', async () => {
    mockNoAvatar();
    mockNoOwnedGroups();

    const res = await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
  });

  it('deletes the avatar from object storage after the DB transaction succeeds', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      avatarUrl: 'https://cdn.example.com/old.png',
    } as never);
    mockNoOwnedGroups();

    await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    const { deleteObjectByUrl } = await import('../../src/config/storage.js');
    expect(deleteObjectByUrl).toHaveBeenCalledWith('https://cdn.example.com/old.png');
  });

  it('promotes the oldest remaining member to OWNER for communities with other members', async () => {
    const COMMUNITY_ID = 'c1';
    const HEIR_ID = 'heir-1';

    mockNoAvatar();
    mockedCommunityMember.findMany.mockResolvedValueOnce([
      { communityId: COMMUNITY_ID },
    ] as never);
    mockedCommunityMember.findFirst.mockResolvedValueOnce({
      userId: HEIR_ID, role: 'ADMIN',
    } as never);
    mockedOrganizationMember.findMany.mockResolvedValueOnce([] as never);

    await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    // The heir was chosen by [role asc, joinedAt asc] and promoted.
    expect(mockedCommunityMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { communityId: COMMUNITY_ID, userId: { not: USER_ID } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    }));
    expect(mockedCommunityMember.update).toHaveBeenCalledWith({
      where: { communityId_userId: { communityId: COMMUNITY_ID, userId: HEIR_ID } },
      data: { role: 'OWNER' },
    });
    // The community itself was NOT deleted since it has other members.
    expect(mockedCommunity.delete).not.toHaveBeenCalled();
  });

  it('deletes communities with no other members (after detaching their posts)', async () => {
    const COMMUNITY_ID = 'c-solo';

    mockNoAvatar();
    mockedCommunityMember.findMany.mockResolvedValueOnce([
      { communityId: COMMUNITY_ID },
    ] as never);
    mockedCommunityMember.findFirst.mockResolvedValueOnce(null as never);
    mockedOrganizationMember.findMany.mockResolvedValueOnce([] as never);

    await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    expect(mockedPost.updateMany).toHaveBeenCalledWith({
      where: { communityId: COMMUNITY_ID },
      data: { communityId: null },
    });
    expect(mockedCommunity.delete).toHaveBeenCalledWith({ where: { id: COMMUNITY_ID } });
    expect(mockedCommunityMember.update).not.toHaveBeenCalled();
  });

  it('promotes the oldest remaining member to OWNER for organizations with other members', async () => {
    const ORG_ID = 'o1';
    const HEIR_ID = 'heir-2';

    mockNoAvatar();
    mockedCommunityMember.findMany.mockResolvedValueOnce([] as never);
    mockedOrganizationMember.findMany.mockResolvedValueOnce([
      { organizationId: ORG_ID },
    ] as never);
    mockedOrganizationMember.findFirst.mockResolvedValueOnce({
      userId: HEIR_ID, role: 'MEMBER',
    } as never);

    await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    expect(mockedOrganizationMember.update).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: ORG_ID, userId: HEIR_ID } },
      data: { role: 'OWNER' },
    });
    expect(mockedOrganization.delete).not.toHaveBeenCalled();
  });

  it('deletes organizations with no other members (after detaching their posts)', async () => {
    const ORG_ID = 'o-solo';

    mockNoAvatar();
    mockedCommunityMember.findMany.mockResolvedValueOnce([] as never);
    mockedOrganizationMember.findMany.mockResolvedValueOnce([
      { organizationId: ORG_ID },
    ] as never);
    mockedOrganizationMember.findFirst.mockResolvedValueOnce(null as never);

    await request(makeApp())
      .delete(`/api/users/${USER_ID}`)
      .set('Authorization', authHeader());

    expect(mockedPost.updateMany).toHaveBeenCalledWith({
      where: { organizationId: ORG_ID },
      data: { organizationId: null },
    });
    expect(mockedOrganization.delete).toHaveBeenCalledWith({ where: { id: ORG_ID } });
    expect(mockedOrganizationMember.update).not.toHaveBeenCalled();
  });
});
