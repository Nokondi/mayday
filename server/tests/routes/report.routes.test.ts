import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    report: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { reportRoutes } from '../../src/routes/report.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedReport = vi.mocked(prisma.report);
const mockedUser = vi.mocked(prisma.user);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const REPORTED_ID = '00000000-0000-4000-a000-000000000002';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = (banned = false) =>
  `Bearer ${signAccessToken({ id: banned ? 'banned' : USER_ID, email: 'a@b.com', role: 'USER' })}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockedUser.findUnique.mockResolvedValue({ id: USER_ID, isBanned: false } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/reports', () => {
  it('creates a report attributing the current user as reporter', async () => {
    mockedReport.create.mockResolvedValueOnce({ id: 'r1' } as never);

    const res = await request(makeApp())
      .post('/api/reports')
      .set('Authorization', authHeader())
      .send({ reason: 'Spam', reportedUserId: REPORTED_ID });

    expect(res.status).toBe(201);
    expect(mockedReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reporterId: USER_ID, reason: 'Spam', reportedUserId: REPORTED_ID }),
    });
  });

  it('rejects when reason is missing', async () => {
    const res = await request(makeApp())
      .post('/api/reports')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
    expect(mockedReport.create).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).post('/api/reports').send({ reason: 'Spam' });
    expect(res.status).toBe(401);
  });

  it('rejects banned users', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({ id: USER_ID, isBanned: true } as never);
    const res = await request(makeApp())
      .post('/api/reports')
      .set('Authorization', authHeader())
      .send({ reason: 'Spam' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/reports/user', () => {
  it('resolves email to userId and creates a report', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never) // rejectBanned
      .mockResolvedValueOnce({ id: REPORTED_ID } as never); // target lookup by email
    mockedReport.create.mockResolvedValueOnce({ id: 'r1' } as never);

    const res = await request(makeApp())
      .post('/api/reports/user')
      .set('Authorization', authHeader())
      .send({ email: 'target@example.com', reason: 'Harassment', details: 'Sent threats' });

    expect(res.status).toBe(201);
    expect(mockedReport.create).toHaveBeenCalledWith({
      data: {
        reason: 'Harassment',
        details: 'Sent threats',
        reportedUserId: REPORTED_ID,
        reporterId: USER_ID,
      },
    });
  });

  it('returns 404 when no user matches the email', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never) // rejectBanned
      .mockResolvedValueOnce(null as never); // target lookup misses

    const res = await request(makeApp())
      .post('/api/reports/user')
      .set('Authorization', authHeader())
      .send({ email: 'ghost@example.com', reason: 'Spam' });

    expect(res.status).toBe(404);
    expect(mockedReport.create).not.toHaveBeenCalled();
  });

  it('forbids reporting yourself', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never) // rejectBanned
      .mockResolvedValueOnce({ id: USER_ID } as never); // target is the caller

    const res = await request(makeApp())
      .post('/api/reports/user')
      .set('Authorization', authHeader())
      .send({ email: 'a@b.com', reason: 'Self' });

    expect(res.status).toBe(400);
    expect(mockedReport.create).not.toHaveBeenCalled();
  });

  it('validates that email is well-formed', async () => {
    const res = await request(makeApp())
      .post('/api/reports/user')
      .set('Authorization', authHeader())
      .send({ email: 'not-an-email', reason: 'Spam' });

    expect(res.status).toBe(400);
  });

  it('validates that reason is present', async () => {
    const res = await request(makeApp())
      .post('/api/reports/user')
      .set('Authorization', authHeader())
      .send({ email: 'target@example.com' });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp())
      .post('/api/reports/user')
      .send({ email: 'target@example.com', reason: 'Spam' });
    expect(res.status).toBe(401);
  });
});
