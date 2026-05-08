import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    pushSubscription: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { pushRoutes } from '../../src/routes/push.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

const mockedSub = vi.mocked(prisma.pushSubscription);
const mockedUser = vi.mocked(prisma.user);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const userPayload = { id: USER_ID, email: 'alice@example.com', role: 'USER' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/push', pushRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = () => `Bearer ${signAccessToken(userPayload)}`;

const VALID_BODY = {
  endpoint: 'https://fcm.example.com/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
};

beforeEach(() => {
  vi.clearAllMocks();
  // rejectBanned looks up the user
  mockedUser.findUnique.mockResolvedValue({ isBanned: false } as never);
});

describe('GET /api/push/public-key', () => {
  it('does not require auth — the key is public', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/push/public-key');
    expect(res.status).toBe(200);
  });

  it('returns the configured key', async () => {
    // env was parsed at module load; override the value the route reads.
    const original = env.VAPID_PUBLIC_KEY;
    (env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY = 'BTestKey123';

    const app = makeApp();
    const res = await request(app).get('/api/push/public-key');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'BTestKey123' });

    (env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY = original;
  });

  it('returns null when push is not configured', async () => {
    const original = env.VAPID_PUBLIC_KEY;
    (env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY = undefined;

    const app = makeApp();
    const res = await request(app).get('/api/push/public-key');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: null });

    (env as { VAPID_PUBLIC_KEY?: string }).VAPID_PUBLIC_KEY = original;
  });
});

describe('POST /api/push/subscribe', () => {
  it('rejects unauthenticated requests', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/push/subscribe').send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(mockedSub.upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads (missing keys)', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', authHeader())
      .send({ endpoint: 'https://fcm.example.com/abc' });
    expect(res.status).toBe(400);
    expect(mockedSub.upsert).not.toHaveBeenCalled();
  });

  it('rejects payloads with non-URL endpoint', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', authHeader())
      .send({ ...VALID_BODY, endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('upserts on the endpoint and binds the subscription to the current user', async () => {
    mockedSub.upsert.mockResolvedValue({ id: 'sub-1' } as never);

    const app = makeApp();
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', authHeader())
      .set('User-Agent', 'test-agent/1.0')
      .send({ ...VALID_BODY, userAgent: 'test-agent/1.0' });

    expect(res.status).toBe(204);
    expect(mockedSub.upsert).toHaveBeenCalledWith({
      where: { endpoint: VALID_BODY.endpoint },
      create: {
        userId: USER_ID,
        endpoint: VALID_BODY.endpoint,
        p256dh: VALID_BODY.keys.p256dh,
        auth: VALID_BODY.keys.auth,
        userAgent: 'test-agent/1.0',
      },
      update: {
        userId: USER_ID,
        p256dh: VALID_BODY.keys.p256dh,
        auth: VALID_BODY.keys.auth,
        userAgent: 'test-agent/1.0',
      },
    });
  });

  it('persists null userAgent when omitted from the body', async () => {
    mockedSub.upsert.mockResolvedValue({ id: 'sub-1' } as never);

    const app = makeApp();
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', authHeader())
      .send(VALID_BODY);

    const call = mockedSub.upsert.mock.calls[0]?.[0] as
      | {
          create: { userAgent: string | null };
          update: { userAgent: string | null };
        }
      | undefined;
    expect(call?.create.userAgent).toBeNull();
    expect(call?.update.userAgent).toBeNull();
  });

  it('blocks banned users via rejectBanned', async () => {
    mockedUser.findUnique.mockResolvedValue({ isBanned: true } as never);

    const app = makeApp();
    const res = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', authHeader())
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(mockedSub.upsert).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/push/unsubscribe', () => {
  it('rejects unauthenticated requests', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/push/unsubscribe')
      .send({ endpoint: VALID_BODY.endpoint });
    expect(res.status).toBe(401);
    expect(mockedSub.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/push/unsubscribe')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
    expect(mockedSub.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes only rows scoped to the requesting user', async () => {
    mockedSub.deleteMany.mockResolvedValue({ count: 1 } as never);

    const app = makeApp();
    const res = await request(app)
      .delete('/api/push/unsubscribe')
      .set('Authorization', authHeader())
      .send({ endpoint: VALID_BODY.endpoint });

    expect(res.status).toBe(204);
    expect(mockedSub.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: VALID_BODY.endpoint, userId: USER_ID },
    });
  });

  it('returns 204 even when nothing was deleted (idempotent)', async () => {
    mockedSub.deleteMany.mockResolvedValue({ count: 0 } as never);

    const app = makeApp();
    const res = await request(app)
      .delete('/api/push/unsubscribe')
      .set('Authorization', authHeader())
      .send({ endpoint: VALID_BODY.endpoint });

    expect(res.status).toBe(204);
  });
});
