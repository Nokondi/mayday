import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    bugReport: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { bugReportRoutes } from '../../src/routes/bugReport.routes.js';
import { adminRoutes } from '../../src/routes/admin.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedBug = vi.mocked(prisma.bugReport);
const mockedUser = vi.mocked(prisma.user);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const ADMIN_ID = '00000000-0000-4000-a000-000000000099';

const userPayload = { id: USER_ID, email: 'alice@example.com', role: 'USER' };
const adminPayload = { id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bug-reports', bugReportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader(payload = userPayload) {
  return `Bearer ${signAccessToken(payload)}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  // rejectBanned looks up the user; return a non-banned user by default
  mockedUser.findUnique.mockResolvedValue({ isBanned: false } as never);
});

describe('POST /api/bug-reports', () => {
  it('rejects unauthenticated requests', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/bug-reports')
      .send({ title: 'Broken button', description: 'Clicking does nothing' });
    expect(res.status).toBe(401);
  });

  it('creates a bug report for an authenticated user', async () => {
    mockedBug.create.mockResolvedValue({
      id: 'b1',
      title: 'Broken button',
      description: 'Clicking does nothing',
      status: 'OPEN',
      reporterId: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const app = makeApp();
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', authHeader())
      .send({ title: 'Broken button', description: 'Clicking does nothing' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Broken button');
    expect(mockedBug.create).toHaveBeenCalledWith({
      data: {
        title: 'Broken button',
        description: 'Clicking does nothing',
        reporterId: USER_ID,
      },
    });
  });

  it('rejects invalid payloads', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', authHeader())
      .send({ title: '', description: '' });
    expect(res.status).toBe(400);
    expect(mockedBug.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/bug-reports', () => {
  it('forbids non-admin users', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/bug-reports')
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });

  it('returns a paginated list for admins', async () => {
    mockedBug.findMany.mockResolvedValue([
      {
        id: 'b1',
        title: 'Broken button',
        description: 'x',
        status: 'OPEN',
        reporterId: USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        reporter: { id: USER_ID, name: 'Alice', email: 'alice@example.com' },
      },
    ] as never);
    mockedBug.count.mockResolvedValue(1);

    const app = makeApp();
    const res = await request(app)
      .get('/api/admin/bug-reports')
      .set('Authorization', authHeader(adminPayload));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockedBug.findMany).toHaveBeenCalled();
  });

  it('filters by status', async () => {
    mockedBug.findMany.mockResolvedValue([] as never);
    mockedBug.count.mockResolvedValue(0);

    const app = makeApp();
    await request(app)
      .get('/api/admin/bug-reports?status=RESOLVED')
      .set('Authorization', authHeader(adminPayload));

    const call = mockedBug.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ status: 'RESOLVED' });
  });
});

describe('PUT /api/admin/bug-reports/:id', () => {
  it('forbids non-admin users', async () => {
    const app = makeApp();
    const res = await request(app)
      .put('/api/admin/bug-reports/b1')
      .set('Authorization', authHeader())
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid statuses', async () => {
    const app = makeApp();
    const res = await request(app)
      .put('/api/admin/bug-reports/b1')
      .set('Authorization', authHeader(adminPayload))
      .send({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
    expect(mockedBug.update).not.toHaveBeenCalled();
  });

  it('updates status for admins', async () => {
    mockedBug.update.mockResolvedValue({
      id: 'b1',
      title: 'x',
      description: 'y',
      status: 'RESOLVED',
      reporterId: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      reporter: { id: USER_ID, name: 'Alice', email: 'alice@example.com' },
    } as never);

    const app = makeApp();
    const res = await request(app)
      .put('/api/admin/bug-reports/b1')
      .set('Authorization', authHeader(adminPayload))
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(mockedBug.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'RESOLVED' },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
      },
    });
  });
});
