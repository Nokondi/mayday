import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    friendship: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Keep these tests focused on friend bookkeeping, not messaging or delivery.
vi.mock('../../src/routes/message.routes.js', () => ({
  createInviteMessage: vi
    .fn()
    .mockResolvedValue({ id: 'friend-msg-id', conversationId: 'conv-id' }),
  setInviteMessageStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/notification.service.js', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { friendRoutes } from '../../src/routes/friend.routes.js';
import {
  createInviteMessage,
  setInviteMessageStatus,
} from '../../src/routes/message.routes.js';
import { notify } from '../../src/services/notification.service.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedUser = vi.mocked(prisma.user);
const mockedReq = vi.mocked(prisma.friendRequest);
const mockedFriendship = vi.mocked(prisma.friendship);
const mockedTx = vi.mocked(prisma.$transaction);
const mockedCreateMsg = vi.mocked(createInviteMessage);
const mockedSetStatus = vi.mocked(setInviteMessageStatus);
const mockedNotify = vi.mocked(notify);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';
const REQUEST_ID = '00000000-0000-4000-a000-000000000099';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/friends', friendRoutes);
  app.use(errorMiddleware);
  return app;
}

function authHeader(id = USER_ID) {
  return `Bearer ${signAccessToken({ id, email: 'a@b.com', role: 'USER' })}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  // rejectBanned (and the sender lookup) read users by id; default everyone to a
  // non-banned, named user. Tests override per-id where they need a missing user.
  mockedUser.findUnique.mockImplementation((({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id, name: `User ${where.id}`, isBanned: false })) as never);
  // Default to "not friends, no pending request" so each test only sets what it cares about.
  mockedFriendship.findUnique.mockResolvedValue(null as never);
  mockedReq.findUnique.mockResolvedValue(null as never);
  mockedReq.upsert.mockResolvedValue({ id: REQUEST_ID } as never);
  mockedReq.update.mockResolvedValue({ id: REQUEST_ID } as never);
  mockedTx.mockResolvedValue([{}, {}] as never);
  // resetAllMocks wipes the implementations set in the vi.mock factories, so
  // re-establish the helper defaults each run.
  mockedCreateMsg.mockResolvedValue({ id: 'friend-msg-id', conversationId: 'conv-id' });
  mockedSetStatus.mockResolvedValue(undefined);
  mockedNotify.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/friends/requests', () => {
  it('creates a pending request, sends a message card, and notifies the recipient', async () => {
    mockedReq.upsert.mockResolvedValueOnce({ id: REQUEST_ID } as never);
    mockedReq.update.mockResolvedValueOnce({ id: REQUEST_ID } as never);

    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: OTHER_ID });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(mockedCreateMsg).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterId: USER_ID,
        inviteeId: OTHER_ID,
        metadata: expect.objectContaining({ inviteKind: 'FRIEND', status: 'PENDING' }),
      }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      OTHER_ID,
      expect.objectContaining({ type: 'FRIEND_REQUEST', senderId: USER_ID }),
    );
  });

  it('auto-accepts when the recipient already sent a pending request', async () => {
    // Reverse request: OTHER_ID -> USER_ID, pending.
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: USER_ID,
      status: 'PENDING',
      requestMessageId: 'msg-1',
    } as never);

    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: OTHER_ID });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACCEPTED');
    expect(mockedTx).toHaveBeenCalled();
    expect(mockedSetStatus).toHaveBeenCalledWith('msg-1', 'ACCEPTED');
    expect(mockedCreateMsg).not.toHaveBeenCalled();
  });

  it('returns 400 when sending a request to yourself', async () => {
    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: USER_ID });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the recipient does not exist', async () => {
    mockedUser.findUnique.mockImplementation((({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === OTHER_ID
          ? null
          : { id: where.id, name: 'Me', isBanned: false },
      )) as never);

    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: OTHER_ID });
    expect(res.status).toBe(404);
  });

  it('returns 400 when already friends', async () => {
    mockedFriendship.findUnique.mockResolvedValue({ id: 'f1' } as never);
    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: OTHER_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 on an invalid (non-uuid) userId', async () => {
    const res = await request(makeApp())
      .post('/api/friends/requests')
      .set('Authorization', authHeader())
      .send({ userId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(makeApp())
      .post('/api/friends/requests')
      .send({ userId: OTHER_ID });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/friends/me/requests/:id/accept', () => {
  it('establishes the friendship, updates the card, and notifies the sender', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: USER_ID,
      status: 'PENDING',
      requestMessageId: 'msg-1',
    } as never);

    const res = await request(makeApp())
      .post(`/api/friends/me/requests/${REQUEST_ID}/accept`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedTx).toHaveBeenCalled();
    expect(mockedSetStatus).toHaveBeenCalledWith('msg-1', 'ACCEPTED');
    expect(mockedNotify).toHaveBeenCalledWith(
      OTHER_ID,
      expect.objectContaining({ type: 'FRIEND_REQUEST_ACCEPTED', accepterId: USER_ID }),
    );
  });

  it('returns 404 when the request is addressed to someone else', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: 'someone-else',
      status: 'PENDING',
    } as never);
    const res = await request(makeApp())
      .post(`/api/friends/me/requests/${REQUEST_ID}/accept`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 400 when the request is no longer pending', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: USER_ID,
      status: 'ACCEPTED',
    } as never);
    const res = await request(makeApp())
      .post(`/api/friends/me/requests/${REQUEST_ID}/accept`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});

describe('POST /api/friends/me/requests/:id/decline', () => {
  it('declines a pending request and updates the card', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: USER_ID,
      status: 'PENDING',
      requestMessageId: 'msg-1',
    } as never);
    mockedReq.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/friends/me/requests/${REQUEST_ID}/decline`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedSetStatus).toHaveBeenCalledWith('msg-1', 'DECLINED');
  });
});

describe('DELETE /api/friends/requests/:id', () => {
  it('lets the sender withdraw their own pending request', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: USER_ID,
      recipientId: OTHER_ID,
      status: 'PENDING',
      requestMessageId: 'msg-1',
    } as never);
    mockedReq.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .delete(`/api/friends/requests/${REQUEST_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedSetStatus).toHaveBeenCalledWith('msg-1', 'REVOKED');
  });

  it('returns 404 when withdrawing a request the caller did not send', async () => {
    mockedReq.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      senderId: OTHER_ID,
      recipientId: USER_ID,
      status: 'PENDING',
    } as never);
    const res = await request(makeApp())
      .delete(`/api/friends/requests/${REQUEST_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/friends/:userId', () => {
  it('removes an existing friendship', async () => {
    mockedFriendship.deleteMany.mockResolvedValueOnce({ count: 1 } as never);
    const res = await request(makeApp())
      .delete(`/api/friends/${OTHER_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(mockedFriendship.deleteMany).toHaveBeenCalled();
  });
});

describe('GET /api/friends/me/requests', () => {
  it('returns the pending incoming requests', async () => {
    mockedReq.findMany.mockResolvedValueOnce([
      { id: REQUEST_ID, status: 'PENDING', createdAt: new Date(), sender: { id: OTHER_ID } },
    ] as never);
    const res = await request(makeApp())
      .get('/api/friends/me/requests')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
