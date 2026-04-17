import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { adminRoutes } from '../../src/routes/admin.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedUser = vi.mocked(prisma.user);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const ADMIN_ID = '00000000-0000-4000-a000-000000000099';

const userPayload = { id: USER_ID, email: 'alice@example.com', role: 'USER' };
const adminPayload = { id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader(payload = userPayload) {
  return `Bearer ${signAccessToken(payload)}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users', () => {
  it('requires authentication', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('forbids non-admin users', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });

  it('returns a paginated list for admins with no filters', async () => {
    mockedUser.findMany.mockResolvedValue([
      {
        id: USER_ID,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'USER',
        isBanned: false,
        avatarUrl: null,
        createdAt: new Date('2026-01-01'),
      },
    ] as never);
    mockedUser.count.mockResolvedValue(1);

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', authHeader(adminPayload));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(1);

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({});
    expect(call?.orderBy).toEqual({ createdAt: 'desc' });
    expect(call?.skip).toBe(0);
    expect(call?.take).toBe(20);
  });

  it('searches name and email case-insensitively', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?q=alice')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      OR: [
        { name: { contains: 'alice', mode: 'insensitive' } },
        { email: { contains: 'alice', mode: 'insensitive' } },
      ],
    });
  });

  it('filters by role', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?role=ADMIN')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ role: 'ADMIN' });
  });

  it('ignores unrecognized role values', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?role=HACKER')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({});
  });

  it('filters by banned=true and banned=false', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?banned=true')
      .set('Authorization', authHeader(adminPayload));
    expect(mockedUser.findMany.mock.calls[0]?.[0]?.where).toEqual({ isBanned: true });

    await request(app)
      .get('/api/admin/users?banned=false')
      .set('Authorization', authHeader(adminPayload));
    expect(mockedUser.findMany.mock.calls[1]?.[0]?.where).toEqual({ isBanned: false });
  });

  it('combines filters', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?q=bob&role=USER&banned=false')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      OR: [
        { name: { contains: 'bob', mode: 'insensitive' } },
        { email: { contains: 'bob', mode: 'insensitive' } },
      ],
      role: 'USER',
      isBanned: false,
    });
  });

  it('honors page and limit, clamping limit to 50', async () => {
    mockedUser.findMany.mockResolvedValue([] as never);
    mockedUser.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/users?page=3&limit=500')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedUser.findMany.mock.calls[0]?.[0];
    expect(call?.take).toBe(50);
    expect(call?.skip).toBe(100);
  });
});
