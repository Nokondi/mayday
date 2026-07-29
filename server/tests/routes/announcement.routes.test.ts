import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    announcement: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notifyMany: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../src/config/database.js';
import { notifyMany } from '../../src/services/notification.service.js';
import { announcementRoutes } from '../../src/routes/announcement.routes.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedUserFindMany = vi.mocked(prisma.user.findMany);
const mockedTx = vi.mocked(prisma.$transaction);
const mockedNotifyMany = vi.mocked(notifyMany);

const ADMIN_ID = '00000000-0000-4000-a000-000000000099';
const USER_ID = '00000000-0000-4000-a000-000000000001';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/announcements', announcementRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader(payload = { id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' }) {
  return `Bearer ${signAccessToken(payload)}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedNotifyMany.mockResolvedValue(undefined);
});

describe('POST /api/announcements — broadcast recipients', () => {
  function mockCreate(message: string) {
    mockedTx.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        announcement: {
          updateMany: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: 'a1', message, active: true }),
        },
      }),
    );
  }

  it('skips users who muted ANNOUNCEMENTS on every reachable channel', async () => {
    mockCreate('Hello');
    mockedUserFindMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }] as never);

    const res = await request(makeApp())
      .post('/api/announcements')
      .set('Authorization', authHeader())
      .send({ message: 'Hello' });

    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(mockedNotifyMany).toHaveBeenCalled());

    expect(mockedUserFindMany).toHaveBeenCalledWith({
      where: {
        emailVerified: true,
        isBanned: false,
        OR: [
          { NOT: { mutedEmailCategories: { has: 'ANNOUNCEMENTS' } } },
          {
            pushNotificationsEnabled: true,
            NOT: { mutedPushCategories: { has: 'ANNOUNCEMENTS' } },
          },
        ],
      },
      select: { id: true },
    });
    expect(mockedNotifyMany).toHaveBeenCalledWith(
      ['u1', 'u2'],
      { type: 'ANNOUNCEMENT', message: 'Hello' },
    );
  });

  it('returns 403 for a non-admin', async () => {
    const res = await request(makeApp())
      .post('/api/announcements')
      .set('Authorization', authHeader({ id: USER_ID, email: 'a@b.com', role: 'USER' }))
      .send({ message: 'Hello' });

    expect(res.status).toBe(403);
    expect(mockedTx).not.toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await request(makeApp())
      .post('/api/announcements')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
  });
});
