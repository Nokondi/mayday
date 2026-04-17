import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prisma before importing routes so the route handlers bind to the stub.
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    postFulfillment: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
    },
    communityMember: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/storage.js', () => ({
  deleteObjectByUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/middleware/upload.middleware.js', () => ({
  uploadPostImages: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { postRoutes } from '../../src/routes/post.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedPost = vi.mocked(prisma.post);
const mockedUser = vi.mocked(prisma.user);
const mockedOrganization = vi.mocked(prisma.organization);
const mockedTransaction = vi.mocked(prisma.$transaction);

// Valid UUIDs for test data
const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-a000-000000000002';
const ADMIN_ID = '00000000-0000-4000-a000-000000000099';
const ORG_ID = '00000000-0000-4000-a000-000000000010';

const userPayload = { id: USER_ID, email: 'alice@example.com', role: 'USER' };
const adminPayload = { id: ADMIN_ID, email: 'admin@example.com', role: 'ADMIN' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/posts', postRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader(payload = userPayload) {
  return `Bearer ${signAccessToken(payload)}`;
}

function dbPost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: USER_ID,
    organizationId: null,
    communityId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: USER_ID, name: 'Alice', bio: null, location: null, skills: [], avatarUrl: null, createdAt: new Date() },
    organization: null,
    community: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/posts/fulfiller-search', () => {
  it('returns empty arrays when query is missing', async () => {
    const res = await request(makeApp())
      .get('/api/posts/fulfiller-search')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [], organizations: [] });
    expect(mockedUser.findMany).not.toHaveBeenCalled();
  });

  it('returns empty arrays when query is shorter than 2 characters', async () => {
    const res = await request(makeApp())
      .get('/api/posts/fulfiller-search?q=a')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [], organizations: [] });
  });

  it('searches users and organizations when query is 2+ characters', async () => {
    mockedUser.findMany.mockResolvedValueOnce([
      { id: USER_ID, name: 'Alice', avatarUrl: null },
    ] as never);
    mockedOrganization.findMany.mockResolvedValueOnce([
      { id: ORG_ID, name: 'Aid League', avatarUrl: null },
    ] as never);

    const res = await request(makeApp())
      .get('/api/posts/fulfiller-search?q=al')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({ id: USER_ID, name: 'Alice' });
    expect(res.body.organizations).toHaveLength(1);
    expect(res.body.organizations[0]).toMatchObject({ id: ORG_ID, name: 'Aid League' });
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(makeApp())
      .get('/api/posts/fulfiller-search?q=alice');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/posts/:id/fulfill', () => {
  it('marks an open post as fulfilled and creates fulfillment records', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const fulfilledPost = dbPost({
      status: 'FULFILLED',
      fulfillments: [
        { id: 'f1', postId: 'p1', name: 'Bob', userId: OTHER_USER_ID, organizationId: null, createdAt: new Date() },
      ],
    });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        post: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue(fulfilledPost) },
        postFulfillment: { createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({
        fulfillers: [
          { name: 'Bob', userId: OTHER_USER_ID },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FULFILLED');
    expect(res.body.fulfillments).toHaveLength(1);
    expect(res.body.fulfillments[0].name).toBe('Bob');
  });

  it('accepts free-text names without userId or organizationId', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const fulfilledPost = dbPost({
      status: 'FULFILLED',
      fulfillments: [
        { id: 'f1', postId: 'p1', name: 'A neighbor', userId: null, organizationId: null, createdAt: new Date() },
      ],
    });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        post: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue(fulfilledPost) },
        postFulfillment: { createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [{ name: 'A neighbor' }] });

    expect(res.status).toBe(200);
    expect(res.body.fulfillments[0].name).toBe('A neighbor');
    expect(res.body.fulfillments[0].userId).toBeNull();
  });

  it('accepts multiple fulfillers (users and organizations)', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const fulfilledPost = dbPost({
      status: 'FULFILLED',
      fulfillments: [
        { id: 'f1', postId: 'p1', name: 'Alice', userId: OTHER_USER_ID, organizationId: null, createdAt: new Date() },
        { id: 'f2', postId: 'p1', name: 'Red Cross', userId: null, organizationId: ORG_ID, createdAt: new Date() },
        { id: 'f3', postId: 'p1', name: 'A kind stranger', userId: null, organizationId: null, createdAt: new Date() },
      ],
    });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        post: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue(fulfilledPost) },
        postFulfillment: { createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({
        fulfillers: [
          { name: 'Alice', userId: OTHER_USER_ID },
          { name: 'Red Cross', organizationId: ORG_ID },
          { name: 'A kind stranger' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.fulfillments).toHaveLength(3);
  });

  it('returns 404 when the post does not exist', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/posts/nonexistent/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [{ name: 'Bob' }] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Post not found' });
  });

  it('returns 403 when the user is not the author or admin', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ authorId: OTHER_USER_ID }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [{ name: 'Bob' }] });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Not authorized' });
  });

  it('allows an admin to fulfill any post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ authorId: OTHER_USER_ID }) as never,
    );

    const fulfilledPost = dbPost({ status: 'FULFILLED', authorId: OTHER_USER_ID, fulfillments: [
      { id: 'f1', postId: 'p1', name: 'Helper', userId: null, organizationId: null, createdAt: new Date() },
    ] });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        post: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue(fulfilledPost) },
        postFulfillment: { createMany: vi.fn() },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader(adminPayload))
      .send({ fulfillers: [{ name: 'Helper' }] });

    expect(res.status).toBe(200);
  });

  it('returns 400 when the post is already fulfilled', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ status: 'FULFILLED' }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [{ name: 'Bob' }] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Only open posts can be marked as fulfilled' });
  });

  it('returns 400 when fulfillers array is empty', async () => {
    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when a fulfiller name is empty', async () => {
    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .set('Authorization', authHeader())
      .send({ fulfillers: [{ name: '' }] });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(makeApp())
      .post('/api/posts/p1/fulfill')
      .send({ fulfillers: [{ name: 'Bob' }] });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/posts/:id/reopen', () => {
  it('reopens a fulfilled post and deletes fulfillment records', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ status: 'FULFILLED' }) as never,
    );

    const reopenedPost = dbPost({ status: 'OPEN', fulfillments: [] });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        postFulfillment: { deleteMany: vi.fn() },
        post: { update: vi.fn().mockResolvedValue(reopenedPost) },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/reopen')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.fulfillments).toHaveLength(0);
  });

  it('returns 404 when the post does not exist', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/posts/nonexistent/reopen')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Post not found' });
  });

  it('returns 403 when the user is not the author or admin', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ status: 'FULFILLED', authorId: OTHER_USER_ID }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts/p1/reopen')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Not authorized' });
  });

  it('allows an admin to reopen any post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ status: 'FULFILLED', authorId: OTHER_USER_ID }) as never,
    );

    const reopenedPost = dbPost({ status: 'OPEN', authorId: OTHER_USER_ID, fulfillments: [] });
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        postFulfillment: { deleteMany: vi.fn() },
        post: { update: vi.fn().mockResolvedValue(reopenedPost) },
      };
      return fn(tx);
    });

    const res = await request(makeApp())
      .post('/api/posts/p1/reopen')
      .set('Authorization', authHeader(adminPayload));

    expect(res.status).toBe(200);
  });

  it('returns 400 when the post is not fulfilled', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ status: 'OPEN' }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts/p1/reopen')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Only fulfilled posts can be reopened' });
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(makeApp())
      .post('/api/posts/p1/reopen');

    expect(res.status).toBe(401);
  });
});
