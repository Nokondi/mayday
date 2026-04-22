import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/websocket/index.js', () => ({
  sendToUser: vi.fn(),
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { messageRoutes } from '../../src/routes/message.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { sendToUser } from '../../src/websocket/index.js';

const mockedConv = vi.mocked(prisma.conversation);
const mockedMsg = vi.mocked(prisma.message);
const mockedUser = vi.mocked(prisma.user);
const mockedSend = vi.mocked(sendToUser);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';
const CONV_ID = '00000000-0000-4000-a000-000000000010';

const userPayload = { id: USER_ID, email: 'a@b.com', role: 'USER' };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = () => `Bearer ${signAccessToken(userPayload)}`;

function dbConv(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    participantAId: USER_ID,
    participantBId: OTHER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // rejectBanned middleware
  mockedUser.findUnique.mockResolvedValue({ id: USER_ID, isBanned: false } as never);
});

afterEach(() => vi.restoreAllMocks());

describe('GET /api/messages/conversations', () => {
  it('returns conversations with the other participant, last message, and unread count', async () => {
    mockedConv.findMany.mockResolvedValueOnce([
      {
        ...dbConv(),
        participantA: { id: USER_ID, name: 'Alice' },
        participantB: { id: OTHER_ID, name: 'Bob' },
        messages: [{ id: 'm1', content: 'hi', createdAt: new Date('2026-01-02') }],
      },
    ] as never);
    mockedMsg.count.mockResolvedValueOnce(3 as never);

    const res = await request(makeApp())
      .get('/api/messages/conversations')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      id: CONV_ID,
      otherParticipant: { id: OTHER_ID, name: 'Bob' },
      lastMessage: expect.objectContaining({ content: 'hi' }),
      unreadCount: 3,
    });
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/messages/conversations/:id', () => {
  it('returns messages reversed (oldest-first) and marks receiver messages read', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.findMany.mockResolvedValueOnce([
      { id: 'm2', createdAt: new Date('2026-01-02') },
      { id: 'm1', createdAt: new Date('2026-01-01') },
    ] as never);
    mockedMsg.updateMany.mockResolvedValueOnce({ count: 2 } as never);

    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2']);
    expect(mockedMsg.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: CONV_ID, receiverId: USER_ID, readAt: null },
    }));
  });

  it('returns 404 for a missing conversation', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not a participant', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(
      dbConv({ participantAId: 'x', participantBId: 'y' }) as never,
    );
    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });
});

describe('POST /api/messages/conversations', () => {
  it('creates a new conversation and sends first message', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never) // rejectBanned
      .mockResolvedValueOnce({ id: OTHER_ID } as never); // target participant
    mockedConv.findUnique.mockResolvedValueOnce(null as never);
    mockedConv.create.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce({ id: 'm1', content: 'hi' } as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: OTHER_ID, message: 'hi' });

    expect(res.status).toBe(201);
    expect(mockedMsg.create).toHaveBeenCalled();
    expect(mockedSend).toHaveBeenCalledWith(OTHER_ID, expect.objectContaining({ type: 'NEW_MESSAGE' }));
  });

  it('reuses an existing conversation regardless of participant order', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce({ id: OTHER_ID } as never);
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);

    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: OTHER_ID });

    expect(res.status).toBe(201);
    expect(mockedConv.create).not.toHaveBeenCalled();
    expect(mockedMsg.create).not.toHaveBeenCalled();
  });

  it('rejects self-messages', async () => {
    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: USER_ID });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the target user does not exist', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: OTHER_ID });
    expect(res.status).toBe(404);
  });

  it('validates the body', async () => {
    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/messages/conversations/:id/messages', () => {
  it('sends a message to the other participant and pushes a websocket event', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce({ id: 'm1', receiverId: OTHER_ID } as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'hey' });

    expect(res.status).toBe(201);
    expect(mockedMsg.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderId: USER_ID, receiverId: OTHER_ID, content: 'hey' }),
    }));
    expect(mockedSend).toHaveBeenCalledWith(OTHER_ID, expect.objectContaining({ type: 'NEW_MESSAGE' }));
  });

  it('returns 403 when caller is not a participant', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(
      dbConv({ participantAId: 'x', participantBId: 'y' }) as never,
    );
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'hey' });
    expect(res.status).toBe(403);
  });

  it('validates the body', async () => {
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});
