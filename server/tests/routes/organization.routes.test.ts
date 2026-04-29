import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationInvite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    post: { updateMany: vi.fn() },
    postFulfillment: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/storage.js', () => ({
  deleteObjectByUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/middleware/upload.middleware.js', () => ({
  uploadAvatar: (req: { file?: unknown }, _res: unknown, next: () => void) => {
    req.file = { location: 'https://cdn.example.com/new.png' };
    next();
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { organizationRoutes } from '../../src/routes/organization.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedOrg = vi.mocked(prisma.organization);
const mockedMember = vi.mocked(prisma.organizationMember);
const mockedInvite = vi.mocked(prisma.organizationInvite);
const mockedUser = vi.mocked(prisma.user);
const mockedPost = vi.mocked(prisma.post);
const mockedTx = vi.mocked(prisma.$transaction);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-a000-000000000002';
const ORG_ID = '00000000-0000-4000-a000-000000000010';
const INVITE_ID = '00000000-0000-4000-a000-000000000020';
const userPayload = { id: USER_ID, email: 'a@b.com', role: 'USER' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/organizations', organizationRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = () => `Bearer ${signAccessToken(userPayload)}`;

function dbOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: ORG_ID,
    name: 'Acme Co',
    description: null,
    location: null,
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
  mockedUser.findUnique.mockResolvedValue({ id: USER_ID, isBanned: false } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/organizations', () => {
  it('lists organizations with membership and pagination meta', async () => {
    mockedOrg.findMany.mockResolvedValueOnce([
      { ...dbOrg(), _count: { members: 4 }, members: [{ role: 'OWNER' }] },
    ] as never);
    mockedOrg.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp()).get('/api/organizations').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: ORG_ID, memberCount: 4, myRole: 'OWNER' });
    expect(res.body.totalPages).toBe(1);
  });

  it('requires auth', async () => {
    const res = await request(makeApp()).get('/api/organizations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/organizations/mine', () => {
  it('flattens memberships into organization summaries', async () => {
    const mockedOrgMember = vi.mocked(prisma.organizationMember);
    mockedOrgMember.findMany.mockResolvedValueOnce([
      { role: 'MEMBER', organization: { ...dbOrg(), _count: { members: 2 } } },
    ] as never);

    const res = await request(makeApp())
      .get('/api/organizations/mine')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: ORG_ID, myRole: 'MEMBER', memberCount: 2 });
  });
});

describe('organization invite me-side flow', () => {
  it('lists pending invites for the current user', async () => {
    mockedInvite.findMany.mockResolvedValueOnce([{ id: INVITE_ID }] as never);
    const res = await request(makeApp())
      .get('/api/organizations/me/invites')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(INVITE_ID);
  });

  it('accepts an invite (transactional membership + update)', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: USER_ID, organizationId: ORG_ID, status: 'PENDING',
    } as never);
    mockedTx.mockResolvedValueOnce([{}, {}] as never);

    const res = await request(makeApp())
      .post(`/api/organizations/me/invites/${INVITE_ID}/accept`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(mockedTx).toHaveBeenCalledTimes(1);
  });

  it('rejects accepting someone else\'s invite', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: OTHER_USER_ID, status: 'PENDING',
    } as never);
    const res = await request(makeApp())
      .post(`/api/organizations/me/invites/${INVITE_ID}/accept`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('declines an invite', async () => {
    mockedInvite.findUnique.mockResolvedValueOnce({
      id: INVITE_ID, invitedUserId: USER_ID, status: 'PENDING',
    } as never);
    mockedInvite.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/organizations/me/invites/${INVITE_ID}/decline`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});

describe('POST /api/organizations', () => {
  it('creates org with current user as OWNER', async () => {
    mockedOrg.create.mockResolvedValueOnce({
      ...dbOrg(), _count: { members: 1 }, members: [{ role: 'OWNER' }],
    } as never);

    const res = await request(makeApp())
      .post('/api/organizations')
      .set('Authorization', authHeader())
      .send({ name: 'Acme Co' });

    expect(res.status).toBe(201);
    expect(res.body.myRole).toBe('OWNER');
  });

  it('rejects invalid input', async () => {
    const res = await request(makeApp())
      .post('/api/organizations')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/organizations/:id', () => {
  it('returns a detailed org with members and my role', async () => {
    mockedOrg.findUnique.mockResolvedValueOnce({
      ...dbOrg(),
      _count: { members: 1 },
      members: [{ userId: USER_ID, role: 'OWNER', user: { id: USER_ID } }],
    } as never);

    const res = await request(makeApp())
      .get(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.myRole).toBe('OWNER');
  });

  it('returns 404 when the org does not exist', async () => {
    mockedOrg.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp())
      .get(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/organizations/:id', () => {
  it('lets OWNER update', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedOrg.update.mockResolvedValueOnce(dbOrg({ name: 'New' }) as never);
    const res = await request(makeApp())
      .patch(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
  });

  it('forbids MEMBERs', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' } as never);
    const res = await request(makeApp())
      .patch(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader())
      .send({ name: 'New' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/organizations/:id/avatar', () => {
  it('updates avatar and deletes old object', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedOrg.findUnique.mockResolvedValueOnce({ avatarUrl: 'https://cdn.example.com/old.png' } as never);
    mockedOrg.update.mockResolvedValueOnce(
      dbOrg({ avatarUrl: 'https://cdn.example.com/new.png' }) as never,
    );

    const res = await request(makeApp())
      .post(`/api/organizations/${ORG_ID}/avatar`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    const { deleteObjectByUrl } = await import('../../src/config/storage.js');
    expect(deleteObjectByUrl).toHaveBeenCalledWith('https://cdn.example.com/old.png');
  });

  it('forbids non-admins', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' } as never);
    const res = await request(makeApp())
      .post(`/api/organizations/${ORG_ID}/avatar`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/organizations/:id', () => {
  it('lets OWNER delete, detaching posts', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedPost.updateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockedOrg.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(mockedPost.updateMany).toHaveBeenCalled();
  });

  it('forbids non-owners', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/organizations/:id/members/:userId', () => {
  it('OWNER can change other member role', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    mockedMember.update.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .patch(`/api/organizations/${ORG_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(200);
  });

  it('OWNER cannot change own role', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' } as never);
    const res = await request(makeApp())
      .patch(`/api/organizations/${ORG_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('ADMIN cannot change roles', async () => {
    mockedMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .patch(`/api/organizations/${ORG_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader())
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/organizations/:id/members/:userId', () => {
  it('OWNER can remove a MEMBER', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce({ role: 'MEMBER' } as never);
    mockedMember.delete.mockResolvedValueOnce({} as never);
    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });

  it('OWNER cannot leave', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce({ role: 'OWNER' } as never);
    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('ADMIN cannot remove another ADMIN', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' } as never)
      .mockResolvedValueOnce({ role: 'ADMIN' } as never);
    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}/members/${OTHER_USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });

  it('MEMBER can leave voluntarily', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'MEMBER' } as never)
      .mockResolvedValueOnce({ role: 'MEMBER' } as never);
    mockedMember.delete.mockResolvedValueOnce({} as never);
    const res = await request(makeApp())
      .delete(`/api/organizations/${ORG_ID}/members/${USER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/left/i);
  });
});

describe('POST /api/organizations/:id/invites', () => {
  it('creates a new invite for an eligible email', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' } as never)
      .mockResolvedValueOnce(null as never);
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce({ id: OTHER_USER_ID } as never);
    mockedInvite.findUnique.mockResolvedValueOnce(null as never);
    mockedInvite.create.mockResolvedValueOnce({ id: INVITE_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/organizations/${ORG_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(201);
  });

  it('refuses duplicate pending invites', async () => {
    mockedMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' } as never)
      .mockResolvedValueOnce(null as never);
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce({ id: OTHER_USER_ID } as never);
    mockedInvite.findUnique.mockResolvedValueOnce({ id: INVITE_ID, status: 'PENDING' } as never);

    const res = await request(makeApp())
      .post(`/api/organizations/${ORG_ID}/invites`)
      .set('Authorization', authHeader())
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(409);
  });
});
