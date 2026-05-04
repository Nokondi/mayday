import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    community: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    communityMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    communityInvite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    communityJoinRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    post: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/storage.js', () => ({
  deleteObjectByUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/middleware/upload.middleware.js', () => ({
  uploadAvatar: (req: { file?: unknown }, _res: unknown, next: () => void) => {
    req.file = { location: 'https://cdn.example.com/new-avatar.png' };
    next();
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { communityRoutes } from '../../src/routes/community.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedCommunity = vi.mocked(prisma.community);
const mockedMember = vi.mocked(prisma.communityMember);
const mockedInvite = vi.mocked(prisma.communityInvite);
const mockedJoinReq = vi.mocked(prisma.communityJoinRequest);
const mockedUser = vi.mocked(prisma.user);
const mockedPost = vi.mocked(prisma.post);
const mockedTx = vi.mocked(prisma.$transaction);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-a000-000000000002';
const COMMUNITY_ID = '00000000-0000-4000-a000-000000000010';
const INVITE_ID = '00000000-0000-4000-a000-000000000020';
const REQ_ID = '00000000-0000-4000-a000-000000000030';

const userPayload = { id: USER_ID, email: 'alice@example.com', role: 'USER' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/communities', communityRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader() {
  return `Bearer ${signAccessToken(userPayload)}`;
}

function dbUser() {
  return { id: USER_ID, isBanned: false };
}

function dbCommunity(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMUNITY_ID,
    name: 'Eastside Neighbors',
    description: 'Local community',
    location: 'Seattle',
    latitude: null,
    longitude: null,
    avatarUrl: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // rejectBanned middleware calls prisma.user.findUnique to check ban status.
  mockedUser.findUnique.mockResolvedValue(dbUser() as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/communities', () => {
  it('returns paginated communities with membership and request state', async () => {
    mockedCommunity.findMany.mockResolvedValueOnce([
      {
        ...dbCommunity(),
        _count: { members: 5 },
        members: [{ role: 'MEMBER' }],
        joinRequests: [],
      },
    ] as never);
    mockedCommunity.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp()).get('/api/communities').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: COMMUNITY_ID,
      memberCount: 5,
      myRole: 'MEMBER',
      myJoinRequestStatus: null,
    });
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('filters by search query using case-insensitive OR on name/description', async () => {
    mockedCommunity.findMany.mockResolvedValueOnce([] as never);
    mockedCommunity.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/communities?q=east&page=2&limit=10')
      .set('Authorization', authHeader());

    const args = mockedCommunity.findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.where).toEqual({
      OR: [
        { name: { contains: 'east', mode: 'insensitive' } },
        { description: { contains: 'east', mode: 'insensitive' } },
      ],
    });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).get('/api/communities');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/communities/mine', () => {
  it('returns memberships flattened to community summaries', async () => {
    mockedMember.findMany.mockResolvedValueOnce([
      {
        role: 'OWNER',
        community: { ...dbCommunity(), _count: { members: 3 } },
      },
    ] as never);

    const res = await request(makeApp())
      .get('/api/communities/mine')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: COMMUNITY_ID, memberCount: 3, myRole: 'OWNER' });
  });
});

describe('GET /api/communities/me/invites', () => {
  it('lists pending invites for the current user', async () => {
    mockedInvite.findMany.mockResolvedValueOnce([{ id: INVITE_ID, status: 'PENDING' }] as never);

    const res = await request(makeApp())
      .get('/api/communities/me/invites')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedInvite.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { invitedUserId: USER_ID, status: 'PENDING' },
    }));
    expect(res.body[0].id).toBe(INVITE_ID);
  });
});

describe('POST /api/communities/me/invites/:inviteId/accept', () => {
  it('creates a membership and marks the invite accepted', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: USER_ID, communityId: COMMUNITY_ID, status: 'PENDING',
    } as never);
    mockedTx.mockResolvedValueOnce([{}, {}] as never);

    const res = await request(makeApp())
      .post(`/api/communities/me/invites/${INVITE_ID}/accept`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/accepted/i);
    expect(mockedTx).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the invite is for another user', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: OTHER_USER_ID, status: 'PENDING',
    } as never);

    const res = await request(makeApp())
      .post(`/api/communities/me/invites/${INVITE_ID}/accept`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 400 when the invite is no longer pending', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: USER_ID, status: 'ACCEPTED',
    } as never);

    const res = await request(makeApp())
      .post(`/api/communities/me/invites/${INVITE_ID}/accept`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });
});

describe('POST /api/communities/me/invites/:inviteId/decline', () => {
  it('marks the invite declined', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: USER_ID, status: 'PENDING',
    } as never);
    mockedInvite.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/communities/me/invites/${INVITE_ID}/decline`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedInvite.update).toHaveBeenCalledWith({
      where: { id: INVITE_ID }, data: { status: 'DECLINED' },
    });
  });
});

describe('POST /api/communities', () => {
  it('creates a community with the current user as OWNER', async () => {
    mockedCommunity.create.mockResolvedValueOnce({
      ...dbCommunity(),
      _count: { members: 1 },
      members: [{ role: 'OWNER' }],
    } as never);

    const res = await request(makeApp())
      .post('/api/communities')
      .set('Authorization', authHeader())
      .send({ name: 'Eastside Neighbors', description: 'Local community' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: COMMUNITY_ID, memberCount: 1, myRole: 'OWNER' });
    const createArgs = mockedCommunity.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data.members).toEqual({ create: { userId: USER_ID, role: 'OWNER' } });
  });

  it('returns 400 when the body fails validation', async () => {
    const res = await request(makeApp())
      .post('/api/communities')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
    expect(mockedCommunity.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/communities/:id', () => {
  it('returns a community with membership list and my role', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce({
      ...dbCommunity(),
      _count: { members: 2 },
      members: [
        { userId: USER_ID, role: 'OWNER', user: { id: USER_ID } },
        { userId: OTHER_USER_ID, role: 'MEMBER', user: { id: OTHER_USER_ID } },
      ],
      joinRequests: [],
    } as never);

    const res = await request(makeApp())
      .get(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: COMMUNITY_ID, memberCount: 2, myRole: 'OWNER' });
    expect(res.body.members).toHaveLength(2);
  });

  it('returns 404 when the community does not exist', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp())
      .get(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/communities/:id', () => {
  it('allows an OWNER to update the community', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedCommunity.update.mockResolvedValueOnce(dbCommunity({ name: 'Renamed' }) as never);

    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('forbids MEMBERs from updating', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' } as never);
    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Renamed' });
    expect(res.status).toBe(403);
  });

  it('forbids non-members from updating', async () => {
    mockedMember.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Renamed' });
    expect(res.status).toBe(403);
  });

  // Avatar is now set via POST /:id/avatar only — PATCH must not accept avatarUrl,
  // even from a stale client that still sends it. Pin the strip so a regression
  // can't silently re-enable that channel.
  it('ignores avatarUrl in the request body and never persists it', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedCommunity.update.mockResolvedValueOnce(dbCommunity({ name: 'Renamed' }) as never);

    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'Renamed', avatarUrl: 'https://evil.example.com/forced.png' });

    expect(res.status).toBe(200);
    expect(mockedCommunity.update).toHaveBeenCalledTimes(1);
    const data = mockedCommunity.update.mock.calls[0][0]?.data ?? {};
    expect(data).not.toHaveProperty('avatarUrl');
  });
});

describe('POST /api/communities/:id/avatar', () => {
  it('updates the avatar URL and removes the previous object', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedCommunity.findUnique.mockResolvedValueOnce({ avatarUrl: 'https://cdn.example.com/old.png' } as never);
    mockedCommunity.update.mockResolvedValueOnce(
      dbCommunity({ avatarUrl: 'https://cdn.example.com/new-avatar.png' }) as never,
    );

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/avatar`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://cdn.example.com/new-avatar.png');
    const { deleteObjectByUrl } = await import('../../src/config/storage.js');
    expect(deleteObjectByUrl).toHaveBeenCalledWith('https://cdn.example.com/old.png');
  });

  it('forbids non-admins', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' } as never);
    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/avatar`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/communities/:id', () => {
  it('allows the OWNER to delete, detaching posts', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedPost.updateMany.mockResolvedValueOnce({ count: 2 } as never);
    mockedCommunity.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedPost.updateMany).toHaveBeenCalledWith({
      where: { communityId: COMMUNITY_ID },
      data: { communityId: null },
    });
    expect(mockedCommunity.delete).toHaveBeenCalled();
  });

  it('forbids non-owners', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/communities/:id/members/:userId', () => {
  it('lets the OWNER change a member role', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedMember.update.mockResolvedValueOnce({ role: 'ADMIN' } as never);

    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMIN');
  });

  it('forbids non-owners (even admins)', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('rejects self role changes', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    const res = await request(makeApp())
      .patch(`/api/communities/${COMMUNITY_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/communities/:id/members/:userId', () => {
  it('lets an OWNER remove a MEMBER', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce({ role: 'MEMBER' } as never);
    mockedMember.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('prevents the OWNER from leaving their own community', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce({ role: 'OWNER' } as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('prevents an ADMIN from removing another ADMIN', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' } as never)
      .mockResolvedValueOnce({ role: 'ADMIN' } as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });

  it('lets a MEMBER leave voluntarily', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'MEMBER' } as never)
      .mockResolvedValueOnce({ role: 'MEMBER' } as never);
    mockedMember.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/left/i);
  });
});

describe('POST /api/communities/:id/invites', () => {
  it('creates a new invite when target is not a member and has no prior invite', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce(null as never);
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never).mockResolvedValueOnce({ id: OTHER_USER_ID } as never);
    mockedInvite.findUnique.mockResolvedValueOnce(null as never);
    mockedInvite.create.mockResolvedValueOnce({ id: INVITE_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(201);
    expect(mockedInvite.create).toHaveBeenCalled();
  });

  it('re-sends a previously declined invite instead of erroring', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce(null as never);
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never).mockResolvedValueOnce({ id: OTHER_USER_ID } as never);
    mockedInvite.findUnique.mockResolvedValueOnce({ id: INVITE_ID, status: 'DECLINED' } as never);
    mockedInvite.update.mockResolvedValueOnce({ id: INVITE_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(201);
    expect(mockedInvite.create).not.toHaveBeenCalled();
    expect(mockedInvite.update).toHaveBeenCalled();
  });

  it('rejects inviting an existing member', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce({ role: 'MEMBER' } as never);
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never).mockResolvedValueOnce({ id: OTHER_USER_ID } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when no user matches the email', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never).mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'ghost@example.com' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/communities/:id/invites/:inviteId', () => {
  it('revokes a pending invite', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, communityId: COMMUNITY_ID, status: 'PENDING',
    } as never);
    mockedInvite.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/communities/${COMMUNITY_ID}/invites/${INVITE_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(mockedInvite.update).toHaveBeenCalledWith({
      where: { id: INVITE_ID }, data: { status: 'REVOKED' },
    });
  });
});

describe('POST /api/communities/:id/join-requests', () => {
  it('creates a new join request', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce(dbCommunity() as never);
    mockedMember.findUnique.mockResolvedValueOnce(null as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce(null as never);
    mockedJoinReq.create.mockResolvedValueOnce({ id: REQ_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests`)
      .set('Authorization', authHeader())
      .send({ message: 'please' });
    expect(res.status).toBe(201);
  });

  it('rejects when already a member', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce(dbCommunity() as never);
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests`)
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(409);
  });

  it('rejects a duplicate pending request', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce(dbCommunity() as never);
    mockedMember.findUnique.mockResolvedValueOnce(null as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce({ id: REQ_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests`)
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(409);
  });

  it('re-submits a previously declined request', async () => {
    mockedCommunity.findUnique.mockResolvedValueOnce(dbCommunity() as never);
    mockedMember.findUnique.mockResolvedValueOnce(null as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce({ id: REQ_ID, status: 'DECLINED' } as never);
    mockedJoinReq.update.mockResolvedValueOnce({ id: REQ_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests`)
      .set('Authorization', authHeader())
      .send({ message: 'take 2' });
    expect(res.status).toBe(201);
    expect(mockedJoinReq.update).toHaveBeenCalled();
  });
});

describe('POST /api/communities/:id/join-requests/:reqId/approve', () => {
  it('creates a membership and marks the request accepted', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce({
      id: REQ_ID, communityId: COMMUNITY_ID, userId: OTHER_USER_ID, status: 'PENDING',
    } as never);
    mockedTx.mockResolvedValueOnce([{}, {}] as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests/${REQ_ID}/approve`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedTx).toHaveBeenCalledTimes(1);
  });

  it('rejects when request is not pending', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce({
      id: REQ_ID, communityId: COMMUNITY_ID, status: 'ACCEPTED',
    } as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests/${REQ_ID}/approve`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});

describe('POST /api/communities/:id/join-requests/:reqId/reject', () => {
  it('marks the request declined', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    mockedJoinReq.findUnique.mockResolvedValueOnce({
      id: REQ_ID, communityId: COMMUNITY_ID, status: 'PENDING',
    } as never);
    mockedJoinReq.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/communities/${COMMUNITY_ID}/join-requests/${REQ_ID}/reject`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedJoinReq.update).toHaveBeenCalledWith({
      where: { id: REQ_ID }, data: { status: 'DECLINED' },
    });
  });
});
