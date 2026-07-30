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
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    postImage: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

// The comment endpoints fan out notifications via notifyMany. Stub the whole
// service so no email/push side effects fire and we can assert recipients.
vi.mock('../../src/services/notification.service.js', () => ({
  notifyMany: vi.fn().mockResolvedValue(undefined),
}));

// Post creation fans out NEW_POST notifications fire-and-forget. Stub the
// service so no fan-out queries run and we can assert the derived params.
vi.mock('../../src/services/postNotification.service.js', () => ({
  notifyNewPost: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../src/config/database.js';
import { deleteObjectByUrl } from '../../src/config/storage.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { postRoutes } from '../../src/routes/post.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { notifyMany } from '../../src/services/notification.service.js';
import { notifyNewPost } from '../../src/services/postNotification.service.js';

const mockedComment = vi.mocked(prisma.comment);
const mockedNotifyMany = vi.mocked(notifyMany);
const mockedNotifyNewPost = vi.mocked(notifyNewPost);

const mockedPost = vi.mocked(prisma.post);
const mockedDeleteObjectByUrl = vi.mocked(deleteObjectByUrl);
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
  // rejectBanned (on comment writes) looks the actor up — default to not banned.
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ isBanned: false } as never);
  // resetAllMocks clears the storage stub's resolved value; restore it so
  // `deleteObjectByUrl(...).catch(...)` has a promise to chain off.
  mockedDeleteObjectByUrl.mockResolvedValue(undefined as never);
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

describe('GET /api/posts — type filter', () => {
  it('passes type=EVENT through to the prisma where clause', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts?type=EVENT')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.type).toBe('EVENT');
  });

  it('ignores an unknown type value', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    await request(makeApp())
      .get('/api/posts?type=PARTY')
      .set('Authorization', authHeader());

    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.type).toBeUndefined();
  });
});

describe('POST /api/posts — events', () => {
  const eventBody = {
    type: 'EVENT',
    title: 'Community potluck',
    description: 'Bring a dish to share',
    category: 'Food',
    urgency: 'LOW',
  };

  it('returns 400 when an event has no start date', async () => {
    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send(eventBody);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/start date/i);
    expect(mockedPost.create).not.toHaveBeenCalled();
  });

  it('creates an event when a start date is provided', async () => {
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ type: 'EVENT', startAt: new Date('2026-08-01T17:00:00Z') }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...eventBody, startAt: '2026-08-01T17:00:00Z' });

    expect(res.status).toBe(201);
    const createArg = (mockedPost.create.mock.calls[0] as [{ data: { type: string; startAt: unknown } }])[0].data;
    expect(createArg.type).toBe('EVENT');
    expect(createArg.startAt).toBeTruthy();
  });
});

describe('POST /api/posts — new-post notifications', () => {
  const body = {
    type: 'REQUEST',
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    urgency: 'HIGH',
  };

  it('fans out notifyNewPost with the created post and its audience', async () => {
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ urgency: 'HIGH', sharedWithFriends: true }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ ...body, sharedWithFriends: true });

    expect(res.status).toBe(201);
    expect(mockedNotifyNewPost).toHaveBeenCalledWith({
      postId: 'p1',
      postTitle: 'Need help',
      urgency: 'HIGH',
      authorId: USER_ID,
      authorName: 'Alice',
      sharedWithFriends: true,
      communityIds: [],
    });
  });

  it('passes the deduplicated community ids through to the fan-out', async () => {
    vi.mocked(prisma.communityMember.findMany).mockResolvedValueOnce([
      { communityId: COMMUNITY_ID_1 },
      { communityId: COMMUNITY_ID_2 },
    ] as never);
    mockedPost.create.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        communities: [
          { community: { id: COMMUNITY_ID_1, name: 'C1' } },
          { community: { id: COMMUNITY_ID_2, name: 'C2' } },
        ],
      }) as never,
    );

    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({
        ...body,
        communityIds: [COMMUNITY_ID_1, COMMUNITY_ID_2, COMMUNITY_ID_1],
      });

    expect(res.status).toBe(201);
    expect(mockedNotifyNewPost).toHaveBeenCalledWith(
      expect.objectContaining({
        communityIds: [COMMUNITY_ID_1, COMMUNITY_ID_2],
      }),
    );
  });

  it('does not fan out when creation fails validation', async () => {
    const res = await request(makeApp())
      .post('/api/posts')
      .set('Authorization', authHeader())
      .send({ type: 'REQUEST' });

    expect(res.status).toBe(400);
    expect(mockedNotifyNewPost).not.toHaveBeenCalled();
  });
});

describe('GET /api/posts/:id/matches', () => {
  it('queries for the opposite type when the post is a request', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost({ type: 'REQUEST' }) as never);
    mockedPost.findMany.mockResolvedValueOnce([
      dbPost({ id: 'm1', type: 'OFFER', authorId: OTHER_USER_ID }),
    ] as never);

    const res = await request(makeApp())
      .get('/api/posts/p1/matches')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;
    expect(whereArg.type).toBe('OFFER');
  });

  it('returns an empty list for an event without querying for matches', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ type: 'EVENT', startAt: new Date('2026-08-01T17:00:00Z') }) as never,
    );

    const res = await request(makeApp())
      .get('/api/posts/p1/matches')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(mockedPost.findMany).not.toHaveBeenCalled();
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

  it('serves public posts only to anonymous requests (no auth header)', async () => {
    mockedPost.findMany.mockResolvedValueOnce([dbPost()] as never);
    mockedPost.count.mockResolvedValueOnce(1 as never);

    const res = await request(makeApp()).get('/api/posts');

    expect(res.status).toBe(200);
    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where;
    expect(whereArg.AND).toContainEqual({
      communities: { none: {} },
      sharedWithFriends: false,
    });
    // No viewer → no community-membership or friendship lookups.
    expect(prisma.communityMember.findMany).not.toHaveBeenCalled();
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
  });

  it('treats an invalid token as anonymous and still serves public posts', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    const res = await request(makeApp())
      .get('/api/posts')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(200);
    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where;
    expect(whereArg.AND).toContainEqual({
      communities: { none: {} },
      sharedWithFriends: false,
    });
  });

  it('ignores friends=true on anonymous requests', async () => {
    mockedPost.findMany.mockResolvedValueOnce([] as never);
    mockedPost.count.mockResolvedValueOnce(0 as never);

    const res = await request(makeApp()).get('/api/posts?friends=true');

    expect(res.status).toBe(200);
    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    const whereArg = (mockedPost.findMany.mock.calls[0] as [{ where: { AND: unknown[] } }])[0].where;
    expect(whereArg.AND).toEqual([
      { communities: { none: {} }, sharedWithFriends: false },
    ]);
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

describe('PUT /api/posts/:id', () => {
  // Mock the update transaction, capturing the tx spies the test asserts on.
  function mockUpdateTransaction(
    updated: ReturnType<typeof dbPost>,
    spies: { update?: ReturnType<typeof vi.fn>; deleteMany?: ReturnType<typeof vi.fn>; createMany?: ReturnType<typeof vi.fn> } = {},
  ) {
    const update = spies.update ?? vi.fn();
    const deleteMany = spies.deleteMany ?? vi.fn();
    const createMany = spies.createMany ?? vi.fn();
    mockedTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        post: { update, findUnique: vi.fn().mockResolvedValue(updated) },
        postImage: { deleteMany, createMany },
      }),
    );
  }

  it('updates editable fields for the author', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);
    mockUpdateTransaction(dbPost({ title: 'Updated title', urgency: 'HIGH' }));

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      .send({ title: 'Updated title', description: 'A longer description', category: 'Food', urgency: 'HIGH' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(res.body.urgency).toBe('HIGH');
  });

  it('does not let an edit change the audience (org / communities / friends)', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);
    const update = vi.fn();
    mockUpdateTransaction(dbPost(), { update });

    await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      .send({
        title: 'Edited',
        organizationId: ORG_ID,
        sharedWithFriends: true,
        communityIds: [COMMUNITY_ID_1],
      });

    const dataArg = (update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
    expect(dataArg.title).toBe('Edited');
    expect(dataArg.organizationId).toBeUndefined();
    expect(dataArg.sharedWithFriends).toBeUndefined();
    expect(dataArg.communityIds).toBeUndefined();
  });

  it('deletes only images that belong to the post (ignores foreign ids)', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        images: [
          { id: 'img-1', url: 'https://cdn.example/x/1.png', order: 0 },
          { id: 'img-2', url: 'https://cdn.example/x/2.png', order: 1 },
        ],
      }) as never,
    );
    const deleteMany = vi.fn();
    mockUpdateTransaction(dbPost(), { deleteMany });

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      .send({ title: 'Edited', removeImageIds: ['img-1', 'not-this-posts-image'] });

    expect(res.status).toBe(200);
    // Only the image that actually belongs to the post is removed.
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['img-1'] } } });
    // Its file is cleaned up from storage after the commit.
    expect(mockedDeleteObjectByUrl).toHaveBeenCalledWith('https://cdn.example/x/1.png');
    expect(mockedDeleteObjectByUrl).not.toHaveBeenCalledWith('https://cdn.example/x/2.png');
  });

  it('ignores non-string entries in a tampered removeImageIds array', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({
        images: [{ id: 'img-1', url: 'https://cdn.example/x/1.png', order: 0 }],
      }) as never,
    );
    const deleteMany = vi.fn();
    mockUpdateTransaction(dbPost(), { deleteMany });

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      // A tampered body can make removeImageIds an array of non-strings.
      .send({ title: 'Edited', removeImageIds: ['img-1', { evil: true }, ['nested']] });

    expect(res.status).toBe(200);
    // Only the well-formed string id is honored; non-strings are dropped.
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['img-1'] } } });
  });

  it('returns 404 when the post does not exist', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .put('/api/posts/nonexistent')
      .set('Authorization', authHeader())
      .send({ title: 'Edited' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Post not found' });
  });

  it('returns 403 when the user is not the author or admin', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ authorId: OTHER_USER_ID }) as never,
    );

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      .send({ title: 'Edited' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Not authorized' });
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it('allows an admin to edit any post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(
      dbPost({ authorId: OTHER_USER_ID }) as never,
    );
    mockUpdateTransaction(dbPost({ authorId: OTHER_USER_ID, title: 'Admin edit' }));

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader(adminPayload))
      .send({ title: 'Admin edit' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Admin edit');
  });

  it('returns 400 on invalid input', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(dbPost() as never);

    const res = await request(makeApp())
      .put('/api/posts/p1')
      .set('Authorization', authHeader())
      .send({ urgency: 'NOT_A_LEVEL' });

    expect(res.status).toBe(400);
    expect(mockedTransaction).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(makeApp())
      .put('/api/posts/p1')
      .send({ title: 'Edited' });

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

const THIRD_USER_ID = '00000000-0000-4000-a000-000000000003';

function dbComment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    postId: 'p1',
    authorId: USER_ID,
    body: 'Nice post',
    editedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: USER_ID, name: 'Alice', bio: null, location: null, skills: [], avatarUrl: null, createdAt: new Date() },
    ...overrides,
  };
}

describe('GET /api/posts/:id/comments', () => {
  it('returns 200 with the comments when the viewer can see the post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce({
      authorId: USER_ID, title: 'Need help', sharedWithFriends: false, communities: [],
    } as never);
    mockedComment.findMany.mockResolvedValueOnce([dbComment()] as never);

    const res = await request(makeApp())
      .get('/api/posts/p1/comments')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].body).toBe('Nice post');
  });

  it('returns 403 when the viewer cannot access the post', async () => {
    mockedPost.findUnique.mockResolvedValueOnce({
      authorId: OTHER_USER_ID, title: 'Private', sharedWithFriends: false,
      communities: [{ communityId: COMMUNITY_ID_1 }],
    } as never);
    vi.mocked(prisma.communityMember.findFirst).mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .get('/api/posts/p1/comments')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
    expect(mockedComment.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the post does not exist', async () => {
    mockedPost.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .get('/api/posts/missing/comments')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/posts/p1/comments');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/posts/:id/comments', () => {
  it('creates a comment and notifies the post author plus prior commenters, excluding the commenter', async () => {
    mockedPost.findUnique.mockResolvedValue({
      authorId: OTHER_USER_ID, title: 'Need help', sharedWithFriends: false, communities: [],
    } as never);
    mockedComment.create.mockResolvedValueOnce(dbComment({ body: 'Hello' }) as never);
    mockedComment.findMany.mockResolvedValueOnce([
      { authorId: THIRD_USER_ID }, { authorId: USER_ID },
    ] as never);

    const res = await request(makeApp())
      .post('/api/posts/p1/comments')
      .set('Authorization', authHeader())
      .send({ body: 'Hello' });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('Hello');

    await vi.waitFor(() => expect(mockedNotifyMany).toHaveBeenCalledTimes(1));
    const [recipients, event] = mockedNotifyMany.mock.calls[0] as [string[], { type: string; postId: string; commenterId: string }];
    expect(recipients.sort()).toEqual([OTHER_USER_ID, THIRD_USER_ID].sort());
    expect(recipients).not.toContain(USER_ID);
    expect(event.type).toBe('NEW_COMMENT');
    expect(event.commenterId).toBe(USER_ID);
  });

  it('returns 400 when the body is empty', async () => {
    mockedPost.findUnique.mockResolvedValue({
      authorId: USER_ID, title: 'Need help', sharedWithFriends: false, communities: [],
    } as never);

    const res = await request(makeApp())
      .post('/api/posts/p1/comments')
      .set('Authorization', authHeader())
      .send({ body: '' });

    expect(res.status).toBe(400);
    expect(mockedComment.create).not.toHaveBeenCalled();
  });

  it('returns 403 when the viewer cannot access the post', async () => {
    mockedPost.findUnique.mockResolvedValue({
      authorId: OTHER_USER_ID, title: 'Private', sharedWithFriends: false,
      communities: [{ communityId: COMMUNITY_ID_1 }],
    } as never);
    vi.mocked(prisma.communityMember.findFirst).mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/posts/p1/comments')
      .set('Authorization', authHeader())
      .send({ body: 'Hello' });

    expect(res.status).toBe(403);
    expect(mockedComment.create).not.toHaveBeenCalled();
  });

  it('returns 401 without auth', async () => {
    const res = await request(makeApp())
      .post('/api/posts/p1/comments')
      .send({ body: 'Hello' });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/posts/:id/comments/:commentId', () => {
  it('lets the comment author edit and stamps editedAt', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({ authorId: USER_ID, postId: 'p1' } as never);
    mockedComment.update.mockResolvedValueOnce(dbComment({ body: 'Edited', editedAt: new Date() }) as never);

    const res = await request(makeApp())
      .put('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader())
      .send({ body: 'Edited' });

    expect(res.status).toBe(200);
    expect(res.body.body).toBe('Edited');
    expect(res.body.editedAt).not.toBeNull();
    const updateArg = mockedComment.update.mock.calls[0][0] as { data: { editedAt: unknown } };
    expect(updateArg.data.editedAt).toBeInstanceOf(Date);
  });

  it('returns 403 when a non-author tries to edit', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({ authorId: OTHER_USER_ID, postId: 'p1' } as never);

    const res = await request(makeApp())
      .put('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader())
      .send({ body: 'Hijack' });

    expect(res.status).toBe(403);
    expect(mockedComment.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the comment belongs to a different post', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({ authorId: USER_ID, postId: 'other-post' } as never);

    const res = await request(makeApp())
      .put('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader())
      .send({ body: 'Edited' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/posts/:id/comments/:commentId', () => {
  it('lets the comment author delete their own comment', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({
      authorId: USER_ID, postId: 'p1',
    } as never);
    mockedComment.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedComment.delete).toHaveBeenCalled();
  });

  it('does NOT let the post owner delete a comment from another user', async () => {
    // The actor (USER_ID) owns the post but is not the comment author or an admin.
    mockedComment.findUnique.mockResolvedValueOnce({
      authorId: OTHER_USER_ID, postId: 'p1',
    } as never);

    const res = await request(makeApp())
      .delete('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
    expect(mockedComment.delete).not.toHaveBeenCalled();
  });

  it('lets a site admin delete any comment', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({
      authorId: OTHER_USER_ID, postId: 'p1',
    } as never);
    mockedComment.delete.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader(adminPayload));

    expect(res.status).toBe(200);
  });

  it('returns 403 when a non-author, non-admin tries to delete', async () => {
    mockedComment.findUnique.mockResolvedValueOnce({
      authorId: OTHER_USER_ID, postId: 'p1',
    } as never);

    const res = await request(makeApp())
      .delete('/api/posts/p1/comments/c1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
    expect(mockedComment.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when the comment does not exist', async () => {
    mockedComment.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .delete('/api/posts/p1/comments/missing')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});
