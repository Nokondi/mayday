import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    device: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
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
import { sendToUser } from '../../src/websocket/index.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { deviceRoutes } from '../../src/routes/device.routes.js';
import { signAccessToken } from '../../src/utils/jwt.js';

const mockedDevice = vi.mocked(prisma.device);
const mockedConversation = vi.mocked(prisma.conversation);
const mockedUser = vi.mocked(prisma.user);
const mockedSendToUser = vi.mocked(sendToUser);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-a000-000000000002';
const PEER_USER_ID = '00000000-0000-4000-a000-000000000003';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/devices', deviceRoutes);
  app.use(errorMiddleware);
  return app;
}

const authHeader = (id = USER_ID) =>
  `Bearer ${signAccessToken({ id, email: 'a@b.c', role: 'USER' })}`;

// 32 bytes of zeros, base64 = 44 chars. 64 bytes of zeros, base64 = 88 chars.
const KEY_32 = Buffer.alloc(32).toString('base64');
const SIG_64 = Buffer.alloc(64).toString('base64');

const VALID_BODY = {
  signingPublicKey: KEY_32,
  encryptionPublicKey: KEY_32,
  encryptionKeySig: SIG_64,
  label: 'Test Browser',
};

const mockDeviceRow = (overrides: Partial<{
  id: string;
  userId: string;
  signingPublicKey: Uint8Array;
  encryptionPublicKey: Uint8Array;
  encryptionKeySig: Uint8Array;
  label: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
}> = {}) => ({
  id: 'dev-1',
  userId: USER_ID,
  signingPublicKey: new Uint8Array(32),
  encryptionPublicKey: new Uint8Array(32),
  encryptionKeySig: new Uint8Array(64),
  label: 'Test Browser',
  createdAt: new Date('2026-05-13T12:00:00Z'),
  lastSeenAt: new Date('2026-05-13T12:00:00Z'),
  revokedAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedUser.findUnique.mockResolvedValue({ isBanned: false } as never);
  mockedConversation.findMany.mockResolvedValue([]);
  // Default: user is under the device cap. Tests that exercise the cap
  // override this with mockResolvedValueOnce(>=20).
  mockedDevice.count.mockResolvedValue(0 as never);
});

describe('POST /api/devices', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(makeApp()).post('/api/devices').send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(mockedDevice.create).not.toHaveBeenCalled();
  });

  it('rejects malformed base64', async () => {
    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send({ ...VALID_BODY, signingPublicKey: '!!!not base64!!!' });
    expect(res.status).toBe(400);
    expect(mockedDevice.create).not.toHaveBeenCalled();
  });

  it('rejects wrong-length signing key (decodes to fewer bytes than 32)', async () => {
    const shortKey = Buffer.alloc(16).toString('base64').padEnd(44, '=');
    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send({ ...VALID_BODY, signingPublicKey: shortKey });
    // The zod schema enforces base64 *string length* (>=43), and decodeKey
    // enforces the *byte length* after decoding. Either layer is fine.
    expect([400]).toContain(res.status);
    expect(mockedDevice.create).not.toHaveBeenCalled();
  });

  it('creates the device, returns it, and fans out DEVICE_ADDED', async () => {
    mockedDevice.create.mockResolvedValue(mockDeviceRow() as never);
    mockedConversation.findMany.mockResolvedValue([
      { participantAId: USER_ID, participantBId: PEER_USER_ID },
    ] as never);

    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('dev-1');
    expect(res.body.signingPublicKey).toBe(KEY_32);

    // Fanout: own user first, then peer
    expect(mockedSendToUser).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      type: 'DEVICE_ADDED',
      payload: expect.objectContaining({ userId: USER_ID }),
    }));
    expect(mockedSendToUser).toHaveBeenCalledWith(PEER_USER_ID, expect.objectContaining({
      type: 'DEVICE_ADDED',
    }));
  });

  it('blocks banned users via rejectBanned', async () => {
    mockedUser.findUnique.mockResolvedValue({ isBanned: true } as never);
    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send(VALID_BODY);
    expect(res.status).toBe(403);
    expect(mockedDevice.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the user is already at the active-device cap', async () => {
    // 20 is the cap. Anything >= cap should reject.
    mockedDevice.count.mockResolvedValueOnce(20 as never);

    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Device limit reached/);
    expect(mockedDevice.create).not.toHaveBeenCalled();
    // The count query is scoped to the caller and excludes revoked rows so
    // a user who has cleaned up old devices can re-register up to the cap.
    expect(mockedDevice.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
    });
  });

  it('allows registration when active count is below the cap', async () => {
    mockedDevice.count.mockResolvedValueOnce(19 as never);
    mockedDevice.create.mockResolvedValue(mockDeviceRow() as never);

    const res = await request(makeApp())
      .post('/api/devices')
      .set('Authorization', authHeader())
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(mockedDevice.create).toHaveBeenCalled();
  });
});

describe('GET /api/devices/me', () => {
  it('returns the caller\'s devices including revoked rows', async () => {
    mockedDevice.findMany.mockResolvedValue([
      mockDeviceRow(),
      mockDeviceRow({ id: 'dev-2', revokedAt: new Date('2026-05-12T00:00:00Z') }),
    ] as never);

    const res = await request(makeApp())
      .get('/api/devices/me')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockedDevice.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('GET /api/devices/users/:userId', () => {
  it('returns peer devices excluding revoked rows', async () => {
    mockedDevice.findMany.mockResolvedValue([mockDeviceRow({ userId: PEER_USER_ID })] as never);

    const res = await request(makeApp())
      .get(`/api/devices/users/${PEER_USER_ID}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(mockedDevice.findMany).toHaveBeenCalledWith({
      where: { userId: PEER_USER_ID, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    // PeerDevice shape — no lastSeenAt or revokedAt to leak activity
    expect(res.body[0]).not.toHaveProperty('lastSeenAt');
    expect(res.body[0]).not.toHaveProperty('revokedAt');
  });
});

describe('DELETE /api/devices/:id', () => {
  it('soft-deletes via revokedAt and fans out DEVICE_REVOKED', async () => {
    mockedDevice.findUnique.mockResolvedValue(mockDeviceRow() as never);
    mockedDevice.update.mockResolvedValue(mockDeviceRow({ revokedAt: new Date() }) as never);
    mockedConversation.findMany.mockResolvedValue([
      { participantAId: USER_ID, participantBId: PEER_USER_ID },
    ] as never);

    const res = await request(makeApp())
      .delete('/api/devices/dev-1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(204);
    expect(mockedDevice.update).toHaveBeenCalledWith({
      where: { id: 'dev-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockedSendToUser).toHaveBeenCalledWith(PEER_USER_ID, {
      type: 'DEVICE_REVOKED',
      payload: { userId: USER_ID, deviceId: 'dev-1' },
    });
  });

  it('returns 404 for non-existent device', async () => {
    mockedDevice.findUnique.mockResolvedValue(null);
    const res = await request(makeApp())
      .delete('/api/devices/nope')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to revoke another user\'s device', async () => {
    mockedDevice.findUnique.mockResolvedValue(mockDeviceRow({ userId: OTHER_USER_ID }) as never);
    const res = await request(makeApp())
      .delete('/api/devices/dev-1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(403);
    expect(mockedDevice.update).not.toHaveBeenCalled();
  });

  it('is idempotent — already-revoked device returns 204 without updating', async () => {
    mockedDevice.findUnique.mockResolvedValue(
      mockDeviceRow({ revokedAt: new Date('2026-05-12T00:00:00Z') }) as never,
    );
    const res = await request(makeApp())
      .delete('/api/devices/dev-1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(mockedDevice.update).not.toHaveBeenCalled();
  });
});
