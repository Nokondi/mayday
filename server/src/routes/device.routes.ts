import { Router } from 'express';
import { registerDeviceSchema, type Device, type PeerDevice } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendToUser } from '../websocket/index.js';

// Sodium key sizes for the validation we do server-side. We can't *verify*
// the signature without dragging libsodium into the backend, but we can at
// least reject blobs that aren't the right length to be valid keys.
const ED25519_PUBLIC_KEY_BYTES = 32;
const X25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIG_BYTES = 64;

function decodeKey(b64: string, expected: number, field: string): Uint8Array<ArrayBuffer> {
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch {
    throw new AppError(400, `Invalid base64 for ${field}`);
  }
  if (buf.length !== expected) {
    throw new AppError(400, `${field} must decode to ${expected} bytes (got ${buf.length})`);
  }
  // Prisma's Bytes column type is Uint8Array<ArrayBuffer>; Node's Buffer is
  // Uint8Array<ArrayBufferLike>. Construct the ArrayBuffer ourselves so the
  // resulting Uint8Array has the narrower type Prisma demands.
  const ab = new ArrayBuffer(buf.length);
  const out = new Uint8Array(ab);
  out.set(buf);
  return out;
}

function toDevice(d: {
  id: string;
  userId: string;
  signingPublicKey: Buffer | Uint8Array;
  encryptionPublicKey: Buffer | Uint8Array;
  encryptionKeySig: Buffer | Uint8Array;
  label: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
}): Device {
  return {
    id: d.id,
    userId: d.userId,
    signingPublicKey: Buffer.from(d.signingPublicKey).toString('base64'),
    encryptionPublicKey: Buffer.from(d.encryptionPublicKey).toString('base64'),
    encryptionKeySig: Buffer.from(d.encryptionKeySig).toString('base64'),
    label: d.label,
    createdAt: d.createdAt.toISOString(),
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    revokedAt: d.revokedAt?.toISOString() ?? null,
  };
}

function toPeerDevice(d: {
  id: string;
  userId: string;
  signingPublicKey: Buffer | Uint8Array;
  encryptionPublicKey: Buffer | Uint8Array;
  encryptionKeySig: Buffer | Uint8Array;
  createdAt: Date;
}): PeerDevice {
  return {
    id: d.id,
    userId: d.userId,
    signingPublicKey: Buffer.from(d.signingPublicKey).toString('base64'),
    encryptionPublicKey: Buffer.from(d.encryptionPublicKey).toString('base64'),
    encryptionKeySig: Buffer.from(d.encryptionKeySig).toString('base64'),
    createdAt: d.createdAt.toISOString(),
  };
}

// Find every user who currently shares a conversation with `userId`. Used to
// fan DEVICE_ADDED/DEVICE_REVOKED events out to peers so their clients can
// (in Phase 3) rescue the conversation key for the new device.
async function findPeerUserIds(userId: string): Promise<string[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ participantAId: userId }, { participantBId: userId }],
    },
    select: { participantAId: true, participantBId: true },
  });
  const peers = new Set<string>();
  for (const c of conversations) {
    if (c.participantAId !== userId) peers.add(c.participantAId);
    if (c.participantBId !== userId) peers.add(c.participantBId);
  }
  return [...peers];
}

export const deviceRoutes = Router();

deviceRoutes.use(requireAuth);
deviceRoutes.use(rejectBanned);

// Register a new device for the authenticated user. Clients call this once
// per browser/install on first launch (and re-call after IndexedDB is cleared,
// which produces a fresh device row — the old one stays around until revoked).
deviceRoutes.post(
  '/',
  validate(registerDeviceSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const body = req.body as import('@mayday/shared').RegisterDeviceRequest;

    const signingPublicKey = decodeKey(body.signingPublicKey, ED25519_PUBLIC_KEY_BYTES, 'signingPublicKey');
    const encryptionPublicKey = decodeKey(body.encryptionPublicKey, X25519_PUBLIC_KEY_BYTES, 'encryptionPublicKey');
    const encryptionKeySig = decodeKey(body.encryptionKeySig, ED25519_SIG_BYTES, 'encryptionKeySig');

    const device = await prisma.device.create({
      data: {
        userId,
        signingPublicKey,
        encryptionPublicKey,
        encryptionKeySig,
        label: body.label ?? null,
        lastSeenAt: new Date(),
      },
    });

    const peer = toPeerDevice(device);

    // Fan out: own other devices first (for handoff in Phase 3), then peers
    // sharing conversations with this user (for peer-rescue in Phase 3).
    sendToUser(userId, { type: 'DEVICE_ADDED', payload: { userId, device: peer } });
    const peerIds = await findPeerUserIds(userId);
    for (const peerUserId of peerIds) {
      sendToUser(peerUserId, { type: 'DEVICE_ADDED', payload: { userId, device: peer } });
    }

    res.status(201).json(toDevice(device));
  }),
);

// List the caller's own devices (for the settings UI). Includes revoked
// devices so the user can see history, but the UI filters them by default.
deviceRoutes.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    const devices = await prisma.device.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(devices.map(toDevice));
  }),
);

// List another user's active devices — used when encrypting to them. Only
// returns non-revoked devices and strips lastSeenAt to avoid leaking activity.
deviceRoutes.get(
  '/users/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const devices = await prisma.device.findMany({
      where: { userId: req.params.userId as string, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    res.json(devices.map(toPeerDevice));
  }),
);

// Revoke a device. Soft-delete via revokedAt so existing conversation key
// wraps tied to this device can be cleaned up in a later phase without
// invalidating message history.
deviceRoutes.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const deviceId = req.params.id as string;

    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) throw new AppError(404, 'Device not found');
    if (existing.userId !== userId) throw new AppError(403, 'Not authorized');
    if (existing.revokedAt) {
      res.status(204).end();
      return;
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });

    sendToUser(userId, { type: 'DEVICE_REVOKED', payload: { userId, deviceId } });
    const peerIds = await findPeerUserIds(userId);
    for (const peerUserId of peerIds) {
      sendToUser(peerUserId, { type: 'DEVICE_REVOKED', payload: { userId, deviceId } });
    }

    res.status(204).end();
  }),
);
