import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
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

beforeEach(() => vi.clearAllMocks());
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

    const res = await request(makeApp()).get(`/api/users/${USER_ID}/posts`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [{ id: 'p1' }, { id: 'p2' }], total: 2, page: 1 });
  });

  it('clamps limit at 50', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp()).get(`/api/users/${USER_ID}/posts?limit=999`);

    const args = mockedPost.findMany.mock.calls[0][0] as { take: number };
    expect(args.take).toBe(50);
  });
});
