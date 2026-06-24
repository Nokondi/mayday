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
      create: vi.fn(),
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
      findFirst: vi.fn(),
    },
    friendship: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
const COMMUNITY_ID_1 = '00000000-0000-4000-a000-000000000020';
const COMMUNITY_ID_2 = '00000000-0000-4000-a000-000000000021';

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
    sharedWithFriends: false,
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: USER_ID,
    organizationId: null,
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
    // PostCommunity join rows as loaded by `postInclude` (the route flattens
    // these to `communities: [{ id, name }]` in the response).
    communities: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // getPostVisibilityFilter / getFriendIds run on most list endpoints; default
  // to "no communities, no friends" so each test only sets what it asserts.
  vi.mocked(prisma.communityMember.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.friendship.findMany).mockResolvedValue([] as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/posts — scheduled filter', () => {
  it('passes startAt: { not: null } to prisma when scheduled=true', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([] as never);
    mockedPost.findMany.mockResolvedValueOnce([dbPost()] as never);
    mockedPost.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp())
      .get('/api/posts?scheduled=true&status=OPEN')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.startAt).toEqual({ not: null });
  });

  it('omits the startAt filter when scheduled is not set', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([] as never);
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.startAt).toBeUndefined();
  });

  it('does not treat scheduled=false as a truthy filter', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([] as never);
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts?scheduled=false')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.startAt).toBeUndefined();
  });
});

describe('GET /api/posts — community visibility', () => {
  it('filters to a single community via communities.some when communityId is given', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([] as never);
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get(`/api/posts?communityId=${COMMUNITY_ID_1}`)
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.communities).toEqual({ some: { communityId: COMMUNITY_ID_1 } });
  });

  it('enforces visibility (public / own / member-community / friends) when no community filter is given', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([
      { communityId: COMMUNITY_ID_1 },
    ] as never);
    vi.mocked(prisma.friendship.findMany).mockResolvedValueOnce([
      { userAId: USER_ID, userBId: OTHER_USER_ID },
    ] as never);
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where;
    expect(whereArg.AND).toContainEqual({
      OR: [
        { authorId: USER_ID },
        { communities: { none: {} }, sharedWithFriends: false },
        { communities: { some: { communityId: { in: [COMMUNITY_ID_1] } } } },
        { sharedWithFriends: true, authorId: { in: [OTHER_USER_ID] } },
      ],
    });
  });

  it('admins bypass the visibility filter entirely', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts')
      .set('Authorization', authHeader(adminPayload));

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND?: unknown[] } }])[0].where;
    expect(whereArg.AND).toBeUndefined();
  });

  it('narrows to friends-shared posts by the viewer\'s friends when friends=true', async () => {
    vi.mocked(prisma.friendship.findMany).mockResolvedValue([
      { userAId: USER_ID, userBId: OTHER_USER_ID },
    ] as never);
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts?friends=true')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where;
    expect(whereArg.AND).toContainEqual({
      sharedWithFriends: true,
      authorId: { in: [OTHER_USER_ID] },
    });
  });

  it('flattens join rows into a communities array in the response', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([] as never);
    mockedPost.findMany.mockResolvedValueOnce([
      dbPost({ communities: [{ community: { id: COMMUNITY_ID_1, name: 'Neighbors' } }] }),
    ] as never);
    mockedPost.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp())
      .get('/api/posts')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data[0].communities).toEqual([{ id: COMMUNITY_ID_1, name: 'Neighbors' }]);
  });
});

describe('POST /api/posts — multiple communities', () => {
  const validBody = {
    type: 'REQUEST',
    title: 'Need help',
    description: 'Some description here',
    category: 'Food',
    urgency: 'MEDIUM',
  };

  it('creates a post scoped to every selected community after verifying membership', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([
      { communityId: COMMUNITY_ID_1 },
      { communityId: COMMUNITY_ID_2 },
    ] as never);
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        communities: [
          { community: { id: COMMUNITY_ID_1, name: 'Neighbors' } },
          { community: { id: COMMUNITY_ID_2, name: 'Garden Club' } },
        ],
      }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...validBody, communityIds: [COMMUNITY_ID_1, COMMUNITY_ID_2] });

    expect(res.status).toBe(201);
    expect(res.body.communities).toHaveLength(2);
    // The join rows are created for both communities.
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: { communities: unknown } }])[0].data;
    expect(createArg.communities).toEqual({
      create: [{ communityId: COMMUNITY_ID_1 }, { communityId: COMMUNITY_ID_2 }],
    });
  });

  it('returns 403 when the author is not a member of one of the selected communities', async () => {
    // Only a member of community 1, but the post targets 1 and 2.
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([
      { communityId: COMMUNITY_ID_1 },
    ] as never);

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...validBody, communityIds: [COMMUNITY_ID_1, COMMUNITY_ID_2] });

    expect(res.status).toBe(403);
    expect(mockedPost.create).not.toHaveBeenCalled();
  });

  it('creates a public post (no community links) when communityIds is omitted', async () => {
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.communities).toEqual([]);
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: { communities?: unknown } }])[0].data;
    expect(createArg.communities).toBeUndefined();
    // No membership lookup needed when there are no communities.
    expect(prisma.communityMember.findMany).not.toHaveBeenCalled();
  });

  it('creates a friends-shared post with sharedWithFriends=true and no communities', async () => {
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ sharedWithFriends: true }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...validBody, sharedWithFriends: true });

    expect(res.status).toBe(201);
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(createArg.sharedWithFriends).toBe(true);
    expect(createArg.communities).toBeUndefined();
    expect(prisma.communityMember.findMany).not.toHaveBeenCalled();
  });

  it('creates a post shared with friends AND a community (union audience)', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([
      { communityId: COMMUNITY_ID_1 },
    ] as never);
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        sharedWithFriends: true,
        communities: [{ community: { id: COMMUNITY_ID_1, name: 'Neighbors' } }],
      }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...validBody, sharedWithFriends: true, communityIds: [COMMUNITY_ID_1] });

    expect(res.status).toBe(201);
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: { sharedWithFriends: boolean; communities: unknown } }])[0].data;
    expect(createArg.sharedWithFriends).toBe(true);
    expect(createArg.communities).toEqual({ create: [{ communityId: COMMUNITY_ID_1 }] });
  });

  it('defaults sharedWithFriends to false for a plain public post', async () => {
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(createArg.sharedWithFriends).toBe(false);
  });
});

describe('GET /api/posts/:id — visibility', () => {
  it('lets a friend view a friends-shared post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ sharedWithFriends: true, authorId: OTHER_USER_ID }) as never,
    );
    vi.mocked(prisma.friendship.findUnique).mockResolvedValueOnce({ id: 'f1' } as never);

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
  });

  it('returns 403 on a friends-shared post when the viewer is not a friend', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ sharedWithFriends: true, authorId: OTHER_USER_ID }) as never,
    );
    vi.mocked(prisma.friendship.findUnique).mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });

  it('lets a community member view a post shared with friends AND that community', async () => {
    // Viewer is not a friend, but is a member of the post's community.
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        sharedWithFriends: true,
        authorId: OTHER_USER_ID,
        communities: [{ community: { id: COMMUNITY_ID_1, name: 'Neighbors' } }],
      }) as never,
    );
    vi.mocked(prisma.communityMember.findFirst).mockResolvedValueOnce({ id: 'm1' } as never);

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
  });

  it('lets the author view their own friends-shared post without a friendship lookup', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ sharedWithFriends: true, authorId: USER_ID }) as never,
    );

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(prisma.friendship.findUnique).not.toHaveBeenCalled();
  });

  it('returns 403 on a community post when the viewer is neither member nor friend', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        authorId: OTHER_USER_ID,
        communities: [{ community: { id: COMMUNITY_ID_1, name: 'Neighbors' } }],
      }) as never,
    );
    vi.mocked(prisma.communityMember.findFirst).mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
  });

  it('lets an admin view any restricted post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ sharedWithFriends: true, authorId: OTHER_USER_ID }) as never,
    );

    const res = await request(makeApp())
      .get('/api/posts/p1')
      .set('Authorization', authHeader(adminPayload));

    expect(res.status).toBe(200);
    expect(prisma.friendship.findUnique).not.toHaveBeenCalled();
  });
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
