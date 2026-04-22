import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    report: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    post: {
      delete: vi.fn(),
    },
    bugReport: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { adminRoutes } from '../../src/routes/admin.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedReport = vi.mocked(prisma.report);
const mockedPost = vi.mocked(prisma.post);
const mockedBugReport = vi.mocked(prisma.bugReport);

const ADMIN_ID = '00000000-0000-4000-a000-000000000099';
const USER_ID = '00000000-0000-4000-a000-000000000001';
const REPORT_ID = '00000000-0000-4000-a000-000000000050';
const POST_ID = '00000000-0000-4000-a000-000000000060';
const BUG_ID = '00000000-0000-4000-a000-000000000070';

const adminHeader = () =>
  `Bearer ${signAccessToken({ id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' })}`;
const userHeader = () =>
  `Bearer ${signAccessToken({ id: USER_ID, email: 'a@b.com', role: 'USER' })}`;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use(errorMiddleware);
  return app;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('admin auth', () => {
  it('rejects non-admin users on any admin route', async () => {
    const res = await request(makeApp())
      .get('/api/admin/reports')
      .set('Authorization', userHeader());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/reports', () => {
  it('returns paginated reports with joins and no filter when status missing', async () => {
    mockedReport.findMany.mockResolvedValueOnce([{ id: REPORT_ID }] as never);
    mockedReport.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp())
      .get('/api/admin/reports')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    const args = mockedReport.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({});
    expect(res.body).toMatchObject({ total: 1, page: 1, totalPages: 1 });
  });

  it('filters by a valid status', async () => {
    mockedReport.findMany.mockResolvedValueOnce([] as never);
    mockedReport.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/admin/reports?status=PENDING')
      .set('Authorization', adminHeader());

    const args = mockedReport.findMany.mock.calls[0][0] as { where: { status?: string } };
    expect(args.where.status).toBe('PENDING');
  });

  it('ignores an invalid status filter', async () => {
    mockedReport.findMany.mockResolvedValueOnce([] as never);
    mockedReport.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/admin/reports?status=BOGUS')
      .set('Authorization', adminHeader());

    const args = mockedReport.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({});
  });
});

describe('PUT /api/admin/reports/:id', () => {
  it('updates status and stamps the resolving admin', async () => {
    mockedReport.update.mockResolvedValueOnce({ id: REPORT_ID, status: 'RESOLVED' } as never);

    const res = await request(makeApp())
      .put(`/api/admin/reports/${REPORT_ID}`)
      .set('Authorization', adminHeader())
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(mockedReport.update).toHaveBeenCalledWith({
      where: { id: REPORT_ID },
      data: { status: 'RESOLVED', resolvedById: ADMIN_ID },
    });
  });

  it('rejects invalid status transitions', async () => {
    const res = await request(makeApp())
      .put(`/api/admin/reports/${REPORT_ID}`)
      .set('Authorization', adminHeader())
      .send({ status: 'PENDING' });
    expect(res.status).toBe(400);
    expect(mockedReport.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/posts/:id', () => {
  it('deletes a post as admin', async () => {
    mockedPost.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/admin/posts/${POST_ID}`)
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
    expect(mockedPost.delete).toHaveBeenCalledWith({ where: { id: POST_ID } });
  });

  it('forbids non-admins', async () => {
    const res = await request(makeApp())
      .delete(`/api/admin/posts/${POST_ID}`)
      .set('Authorization', userHeader());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/bug-reports', () => {
  it('returns paginated bug reports with reporter join', async () => {
    mockedBugReport.findMany.mockResolvedValueOnce([{ id: BUG_ID }] as never);
    mockedBugReport.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp())
      .get('/api/admin/bug-reports')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const args = mockedBugReport.findMany.mock.calls[0][0] as { include: Record<string, unknown> };
    expect(args.include).toHaveProperty('reporter');
  });

  it('filters by a valid status', async () => {
    mockedBugReport.findMany.mockResolvedValueOnce([] as never);
    mockedBugReport.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/admin/bug-reports?status=OPEN')
      .set('Authorization', adminHeader());

    const args = mockedBugReport.findMany.mock.calls[0][0] as { where: { status?: string } };
    expect(args.where.status).toBe('OPEN');
  });

  it('ignores an invalid status filter', async () => {
    mockedBugReport.findMany.mockResolvedValueOnce([] as never);
    mockedBugReport.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/admin/bug-reports?status=INVALID')
      .set('Authorization', adminHeader());

    const args = mockedBugReport.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where).toEqual({});
  });
});

describe('PUT /api/admin/bug-reports/:id', () => {
  it('updates bug report status', async () => {
    mockedBugReport.update.mockResolvedValueOnce({ id: BUG_ID, status: 'RESOLVED' } as never);
    const res = await request(makeApp())
      .put(`/api/admin/bug-reports/${BUG_ID}`)
      .set('Authorization', adminHeader())
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
  });

  it('rejects an invalid status', async () => {
    const res = await request(makeApp())
      .put(`/api/admin/bug-reports/${BUG_ID}`)
      .set('Authorization', adminHeader())
      .send({ status: 'NONSENSE' });
    expect(res.status).toBe(400);
    expect(mockedBugReport.update).not.toHaveBeenCalled();
  });
});
