import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  // $transaction in the route hands us an array of prisma promises; the mock
  // resolves them in order so we observe upsert call shapes the same way as
  // if we'd called upsert directly.
  const $transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));
  return {
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
      device: {
        findMany: vi.fn(),
      },
      conversationKeyWrap: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction,
    },
  };
});

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
const mockedDevice = vi.mocked(prisma.device);
const mockedWrap = vi.mocked(prisma.conversationKeyWrap);
const mockedSend = vi.mocked(sendToUser);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_ID = '00000000-0000-4000-a000-000000000002';
const CONV_ID = '00000000-0000-4000-a000-000000000010';
const DEVICE_ID = '00000000-0000-4000-a000-000000000020';
const OTHER_DEVICE_ID = '00000000-0000-4000-a000-000000000021';
const OUTSIDER_DEVICE_ID = '00000000-0000-4000-a000-000000000022';

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

// Complete Prisma Message row shape — Phase 2 added several nullable encrypted
// fields. toWireMessage reads all of them, so mocks must include them or the
// mapping crashes on undefined.
function dbMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    content: 'hi',
    ciphertext: null,
    nonce: null,
    senderDeviceId: null,
    keyEpoch: null,
    protocolVersion: null,
    senderId: USER_ID,
    receiverId: OTHER_ID,
    conversationId: CONV_ID,
    readAt: null,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

// 24-byte zero nonce, base64 → 32 chars. Real XSalsa20-Poly1305 nonces are 24
// bytes; we exercise the bounds rather than a real crypto round-trip here.
const NONCE_B64 = Buffer.alloc(24).toString('base64');
const CIPHERTEXT_B64 = Buffer.from('ciphertext-bytes').toString('base64');
const WRAPPED_KEY_B64 = Buffer.alloc(48).toString('base64');

const VALID_ENVELOPE = {
  protocolVersion: 1,
  ciphertext: CIPHERTEXT_B64,
  nonce: NONCE_B64,
  senderDeviceId: DEVICE_ID,
  keyEpoch: 1,
};

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) is required because we use
  // mockResolvedValueOnce queues — clearAllMocks only erases call history,
  // leaving queued responses to leak into subsequent tests.
  vi.resetAllMocks();
  mockedUser.findUnique.mockResolvedValue({ id: USER_ID, isBanned: false } as never);
  // resetAllMocks wipes the $transaction implementation set in the mock
  // factory; restore the default that resolves each op as if called directly.
  vi.mocked(prisma.$transaction).mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
    return ops;
  });
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
  it('returns messages reversed (oldest-first) as wire envelope and marks receiver messages read', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.findMany.mockResolvedValueOnce([
      dbMessage({ id: 'm2', createdAt: new Date('2026-01-02') }),
      dbMessage({ id: 'm1', createdAt: new Date('2026-01-01') }),
    ] as never);
    mockedMsg.updateMany.mockResolvedValueOnce({ count: 2 } as never);

    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2']);
    // Wire shape exposes the encrypted-envelope fields (null for legacy plaintext).
    expect(res.body[0]).toHaveProperty('ciphertext', null);
    expect(res.body[0]).toHaveProperty('protocolVersion', null);
    expect(mockedMsg.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationId: CONV_ID, receiverId: USER_ID, readAt: null },
    }));
  });

  it('serializes ciphertext and nonce as base64 strings for encrypted messages', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    const ciphertextBytes = Buffer.from('opaque-bytes');
    const nonceBytes = Buffer.alloc(24, 7);
    mockedMsg.findMany.mockResolvedValueOnce([
      dbMessage({
        id: 'm1',
        content: null,
        ciphertext: ciphertextBytes,
        nonce: nonceBytes,
        senderDeviceId: DEVICE_ID,
        keyEpoch: 1,
        protocolVersion: 1,
      }),
    ] as never);
    mockedMsg.updateMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0].ciphertext).toBe(ciphertextBytes.toString('base64'));
    expect(res.body[0].nonce).toBe(nonceBytes.toString('base64'));
    expect(res.body[0].senderDeviceId).toBe(DEVICE_ID);
    expect(res.body[0].content).toBeNull();
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
  it('creates a new conversation and sends first plaintext message', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce({ id: OTHER_ID } as never);
    mockedConv.findUnique.mockResolvedValueOnce(null as never);
    mockedConv.create.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce(dbMessage({ content: 'hi' }) as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: OTHER_ID, message: 'hi' });

    expect(res.status).toBe(201);
    expect(mockedMsg.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ content: 'hi', ciphertext: null }),
    }));
    expect(mockedSend).toHaveBeenCalledWith(OTHER_ID, expect.objectContaining({ type: 'NEW_MESSAGE' }));
  });

  it('creates a conversation with an encrypted envelope as the first message', async () => {
    mockedUser.findUnique
      .mockResolvedValueOnce({ id: USER_ID, isBanned: false } as never)
      .mockResolvedValueOnce({ id: OTHER_ID } as never);
    mockedConv.findUnique.mockResolvedValueOnce(null as never);
    mockedConv.create.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce(dbMessage({
      content: null,
      ciphertext: Buffer.from('ct'),
      nonce: Buffer.alloc(24),
      senderDeviceId: DEVICE_ID,
      keyEpoch: 1,
      protocolVersion: 1,
    }) as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post('/api/messages/conversations')
      .set('Authorization', authHeader())
      .send({ participantId: OTHER_ID, envelope: VALID_ENVELOPE });

    expect(res.status).toBe(201);
    expect(mockedMsg.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: null,
        senderDeviceId: DEVICE_ID,
        keyEpoch: 1,
        protocolVersion: 1,
      }),
    }));
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
  it('sends a plaintext message and pushes a websocket event with wire envelope', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce(dbMessage({ content: 'hey' }) as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ content: 'hey' });

    expect(res.status).toBe(201);
    expect(mockedMsg.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        senderId: USER_ID,
        receiverId: OTHER_ID,
        content: 'hey',
        ciphertext: null,
      }),
    }));
    expect(mockedSend).toHaveBeenCalledWith(
      OTHER_ID,
      expect.objectContaining({
        type: 'NEW_MESSAGE',
        payload: expect.objectContaining({ content: 'hey', ciphertext: null }),
      }),
    );
    // Response is also the wire envelope.
    expect(res.body).toHaveProperty('ciphertext', null);
  });

  it('sends an encrypted envelope, storing ciphertext + nonce as bytes', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedMsg.create.mockResolvedValueOnce(dbMessage({
      content: null,
      ciphertext: Buffer.from('ct'),
      nonce: Buffer.alloc(24),
      senderDeviceId: DEVICE_ID,
      keyEpoch: 1,
      protocolVersion: 1,
    }) as never);
    mockedConv.update.mockResolvedValueOnce({} as never);

    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ envelope: VALID_ENVELOPE });

    expect(res.status).toBe(201);
    const createArgs = mockedMsg.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.content).toBeNull();
    expect(createArgs.data.senderDeviceId).toBe(DEVICE_ID);
    expect(createArgs.data.protocolVersion).toBe(1);
    expect(createArgs.data.ciphertext).toBeInstanceOf(Uint8Array);
    expect((createArgs.data.ciphertext as Uint8Array).length).toBeGreaterThan(0);
    expect((createArgs.data.nonce as Uint8Array).length).toBe(24);
  });

  it('rejects an envelope whose nonce is the wrong length', async () => {
    const badNonce = Buffer.alloc(16).toString('base64');
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ envelope: { ...VALID_ENVELOPE, nonce: badNonce } });
    expect(res.status).toBe(400);
    expect(mockedMsg.create).not.toHaveBeenCalled();
  });

  it('rejects an envelope with the wrong protocolVersion', async () => {
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ envelope: { ...VALID_ENVELOPE, protocolVersion: 2 } });
    expect(res.status).toBe(400);
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

  it('validates the body (rejects both empty plaintext and missing envelope)', async () => {
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({ content: '' });
    expect(res.status).toBe(400);

    const res2 = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/messages`)
      .set('Authorization', authHeader())
      .send({});
    expect(res2.status).toBe(400);
  });
});

// New key-wrap routes — clients exchange wrapped conversation keys here so
// every participant device can decrypt the message body. The server validates
// that uploaded deviceIds belong to a conversation participant and that the
// caller can only enumerate their own devices' wraps.

describe('POST /api/messages/conversations/:id/key-wraps', () => {
  const VALID_WRAPS = [
    { deviceId: DEVICE_ID, wrappedKey: WRAPPED_KEY_B64, keyEpoch: 1 },
    { deviceId: OTHER_DEVICE_ID, wrappedKey: WRAPPED_KEY_B64, keyEpoch: 1 },
  ];

  it('upserts each wrap and returns 204', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedDevice.findMany.mockResolvedValueOnce([
      { id: DEVICE_ID, userId: USER_ID, revokedAt: null },
      { id: OTHER_DEVICE_ID, userId: OTHER_ID, revokedAt: null },
    ] as never);
    mockedWrap.upsert.mockResolvedValue({ id: 'kw1' } as never);

    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: VALID_WRAPS });

    expect(res.status).toBe(204);
    expect(mockedWrap.upsert).toHaveBeenCalledTimes(2);
    const firstCall = mockedWrap.upsert.mock.calls[0]?.[0] as { where: { conversationId_deviceId_keyEpoch: unknown }; create: { wrappedKey: Uint8Array } };
    expect(firstCall.create.wrappedKey).toBeInstanceOf(Uint8Array);
  });

  it('emits KEY_WRAPS_UPDATED to each affected user with only their own deviceIds', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedDevice.findMany.mockResolvedValueOnce([
      { id: DEVICE_ID, userId: USER_ID, revokedAt: null },
      { id: OTHER_DEVICE_ID, userId: OTHER_ID, revokedAt: null },
    ] as never);
    mockedWrap.upsert.mockResolvedValue({ id: 'kw1' } as never);

    await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: VALID_WRAPS });

    // One event per recipient user — never one user receiving another's
    // deviceIds, which would be a metadata leak about peer device topology.
    expect(mockedSend).toHaveBeenCalledWith(USER_ID, {
      type: 'KEY_WRAPS_UPDATED',
      payload: { conversationId: CONV_ID, deviceIds: [DEVICE_ID] },
    });
    expect(mockedSend).toHaveBeenCalledWith(OTHER_ID, {
      type: 'KEY_WRAPS_UPDATED',
      payload: { conversationId: CONV_ID, deviceIds: [OTHER_DEVICE_ID] },
    });
  });

  it('rejects a wrap whose deviceId belongs to a non-participant — prevents IDOR', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedDevice.findMany.mockResolvedValueOnce([
      { id: OUTSIDER_DEVICE_ID, userId: 'outsider', revokedAt: null },
    ] as never);

    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: [{ deviceId: OUTSIDER_DEVICE_ID, wrappedKey: WRAPPED_KEY_B64, keyEpoch: 1 }] });

    expect(res.status).toBe(403);
    expect(mockedWrap.upsert).not.toHaveBeenCalled();
  });

  it('rejects when a deviceId does not exist', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedDevice.findMany.mockResolvedValueOnce([] as never);
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: [{ deviceId: DEVICE_ID, wrappedKey: WRAPPED_KEY_B64, keyEpoch: 1 }] });
    expect(res.status).toBe(404);
  });

  it('rejects when target device is revoked', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedDevice.findMany.mockResolvedValueOnce([
      { id: DEVICE_ID, userId: USER_ID, revokedAt: new Date() },
    ] as never);
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: [{ deviceId: DEVICE_ID, wrappedKey: WRAPPED_KEY_B64, keyEpoch: 1 }] });
    expect(res.status).toBe(400);
  });

  it('returns 403 when caller is not a participant of the conversation', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(
      dbConv({ participantAId: 'x', participantBId: 'y' }) as never,
    );
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: VALID_WRAPS });
    expect(res.status).toBe(403);
  });

  it('rejects malformed payloads', async () => {
    const res = await request(makeApp())
      .post(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader())
      .send({ wraps: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/messages/conversations/:id/key-wraps', () => {
  it('returns only wraps for the caller\'s own devices', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(dbConv() as never);
    mockedWrap.findMany.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: DEVICE_ID,
        wrappedKey: Buffer.alloc(48),
        keyEpoch: 1,
        createdAt: new Date('2026-05-14T00:00:00Z'),
      },
    ] as never);

    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].wrappedKey).toBe(Buffer.alloc(48).toString('base64'));
    // The where clause filters to devices owned by the caller — protects
    // against enumeration of the peer's wraps.
    expect(mockedWrap.findMany).toHaveBeenCalledWith({
      where: { conversationId: CONV_ID, device: { userId: USER_ID } },
    });
  });

  it('returns 403 when caller is not a participant', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(
      dbConv({ participantAId: 'x', participantBId: 'y' }) as never,
    );
    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
  });

  it('returns 404 when conversation does not exist', async () => {
    mockedConv.findUnique.mockResolvedValueOnce(null as never);
    const res = await request(makeApp())
      .get(`/api/messages/conversations/${CONV_ID}/key-wraps`)
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});
