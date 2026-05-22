import { Router } from 'express';
import {
  sendMessageSchema,
  startConversationSchema,
  uploadKeyWrapsSchema,
  type EncryptedEnvelope,
  type Message as WireMessage,
  type ConversationKeyWrap as WireKeyWrap,
} from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUserSelect } from '../utils/prisma-selects.js';
import { sendToUser } from '../websocket/index.js';
import { notify } from '../services/notification.service.js';

// Helpers for the new encrypted-envelope path. The server never decrypts;
// it just shuttles base64-encoded bytes between Prisma's Bytes columns and
// the JSON wire format.

function bytesToBase64(bytes: Uint8Array | Buffer | null): string | null {
  if (!bytes) return null;
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string, expectedRange: { min: number; max: number }, field: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < expectedRange.min || buf.length > expectedRange.max) {
    throw new AppError(400, `${field} length out of range`);
  }
  const ab = new ArrayBuffer(buf.length);
  const out = new Uint8Array(ab);
  out.set(buf);
  return out;
}

// Shape used for create() data when the message arrives as an encrypted envelope.
// content is set to null; the ciphertext columns are populated.
function envelopeToCreateData(envelope: EncryptedEnvelope) {
  return {
    content: null,
    ciphertext: base64ToBytes(envelope.ciphertext, { min: 1, max: 8192 }, 'ciphertext'),
    nonce: base64ToBytes(envelope.nonce, { min: 24, max: 27 }, 'nonce'),
    senderDeviceId: envelope.senderDeviceId,
    keyEpoch: envelope.keyEpoch,
    protocolVersion: envelope.protocolVersion,
  };
}

// Serialize a Prisma Message row into the WireMessage shape — base64s the
// ciphertext/nonce columns and surfaces nullability cleanly.
function toWireMessage(msg: {
  id: string;
  content: string | null;
  ciphertext: Buffer | Uint8Array | null;
  nonce: Buffer | Uint8Array | null;
  senderDeviceId: string | null;
  keyEpoch: number | null;
  protocolVersion: number | null;
  senderId: string;
  receiverId: string;
  conversationId: string;
  readAt: Date | null;
  createdAt: Date;
}): WireMessage {
  return {
    id: msg.id,
    content: msg.content,
    ciphertext: bytesToBase64(msg.ciphertext),
    nonce: bytesToBase64(msg.nonce),
    senderDeviceId: msg.senderDeviceId,
    keyEpoch: msg.keyEpoch,
    protocolVersion: msg.protocolVersion,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    conversationId: msg.conversationId,
    readAt: msg.readAt?.toISOString() ?? null,
    createdAt: msg.createdAt.toISOString(),
  };
}

// For the notification fan-out: when content is encrypted, we can't include
// it in the email/push body. Phase 4 will wire the SW to decrypt locally;
// for now we send a generic "New message" preview when ciphertext is set.
function notificationContent(msg: { content: string | null }): string {
  return msg.content ?? 'New message';
}

async function notifyReceiver(params: {
  messageId: string;
  receiverId: string;
  senderId: string;
  conversationId: string;
  content: string;
}): Promise<void> {
  try {
    // Only notify if the receiver has no other unread messages in this conversation —
    // avoids spamming during an active back-and-forth.
    const priorUnread = await prisma.message.count({
      where: {
        conversationId: params.conversationId,
        receiverId: params.receiverId,
        readAt: null,
        NOT: { id: params.messageId },
      },
    });
    if (priorUnread > 0) return;

    const sender = await prisma.user.findUnique({
      where: { id: params.senderId },
      select: { name: true },
    });
    if (!sender) return;

    await notify(params.receiverId, {
      type: 'NEW_MESSAGE',
      senderName: sender.name,
      senderId: params.senderId,
      conversationId: params.conversationId,
      content: params.content,
    });
  } catch (err) {
    console.error('[notify] failed to deliver new-message notification', err);
  }
}

export const messageRoutes = Router();

messageRoutes.use(requireAuth);
messageRoutes.use(rejectBanned);

messageRoutes.get('/conversations', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { participantAId: userId },
        { participantBId: userId },
      ],
    },
    include: {
      participantA: { select: publicUserSelect },
      participantB: { select: publicUserSelect },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const result = await Promise.all(conversations.map(async (conv) => {
    const otherParticipant = conv.participantAId === userId
      ? conv.participantB
      : conv.participantA;

    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        receiverId: userId,
        readAt: null,
      },
    });

    return {
      id: conv.id,
      participantAId: conv.participantAId,
      participantBId: conv.participantBId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      otherParticipant,
      lastMessage: conv.messages[0] || null,
      unreadCount,
    };
  }));

  res.json(result);
}));

messageRoutes.get('/conversations/:id', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id as string },
  });
  if (!conv) throw new AppError(404, 'Conversation not found');
  if (conv.participantAId !== userId && conv.participantBId !== userId) {
    throw new AppError(403, 'Not authorized');
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Mark unread messages as read
  await prisma.message.updateMany({
    where: {
      conversationId: conv.id,
      receiverId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  res.json(messages.reverse().map(toWireMessage));
}));

// Conversation key wraps — clients upload sealed conversation keys (one per
// recipient device) when starting an encrypted conversation, then later fetch
// the wrap for their device to decrypt the CK. The server never sees plaintext
// keys; it only verifies that uploaded deviceIds belong to a participant of
// the conversation.

messageRoutes.post(
  '/conversations/:id/key-wraps',
  validate(uploadKeyWrapsSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const body = req.body as import('@mayday/shared').UploadKeyWrapsRequest;

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new AppError(404, 'Conversation not found');
    if (conv.participantAId !== userId && conv.participantBId !== userId) {
      throw new AppError(403, 'Not authorized');
    }

    // Each wrap must target a device belonging to one of the two participants.
    // We look these up in a single query for the whole batch and reject if any
    // deviceId is missing or owned by an outsider — this prevents a caller from
    // smuggling wraps for arbitrary devices into the table.
    const deviceIds = body.wraps.map((w) => w.deviceId);
    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds } },
      select: { id: true, userId: true, revokedAt: true },
    });
    const deviceMap = new Map(devices.map((d) => [d.id, d]));
    for (const w of body.wraps) {
      const d = deviceMap.get(w.deviceId);
      if (!d) throw new AppError(404, `Device ${w.deviceId} not found`);
      if (d.revokedAt) throw new AppError(400, `Device ${w.deviceId} is revoked`);
      if (d.userId !== conv.participantAId && d.userId !== conv.participantBId) {
        throw new AppError(403, `Device ${w.deviceId} does not belong to a participant`);
      }
    }

    // Upsert on (conversationId, deviceId, keyEpoch). Re-uploading the same
    // tuple replaces the wrappedKey, which lets a sender re-wrap if they
    // somehow lose access to their copy.
    const wrappedBuffers = body.wraps.map((w) => ({
      ...w,
      wrappedBytes: base64ToBytes(w.wrappedKey, { min: 1, max: 256 }, 'wrappedKey'),
    }));

    await prisma.$transaction(
      wrappedBuffers.map((w) => prisma.conversationKeyWrap.upsert({
        where: {
          conversationId_deviceId_keyEpoch: {
            conversationId,
            deviceId: w.deviceId,
            keyEpoch: w.keyEpoch,
          },
        },
        create: {
          conversationId,
          deviceId: w.deviceId,
          keyEpoch: w.keyEpoch,
          wrappedKey: w.wrappedBytes,
        },
        update: { wrappedKey: w.wrappedBytes },
      })),
    );

    res.status(204).end();
  }),
);

messageRoutes.get(
  '/conversations/:id/key-wraps',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new AppError(404, 'Conversation not found');
    if (conv.participantAId !== userId && conv.participantBId !== userId) {
      throw new AppError(403, 'Not authorized');
    }

    // Return only wraps for devices the caller owns. A user shouldn't be able
    // to enumerate wraps belonging to the other participant's devices.
    const wraps = await prisma.conversationKeyWrap.findMany({
      where: {
        conversationId,
        device: { userId },
      },
    });

    const result: WireKeyWrap[] = wraps.map((w) => ({
      id: w.id,
      conversationId: w.conversationId,
      deviceId: w.deviceId,
      wrappedKey: Buffer.from(w.wrappedKey).toString('base64'),
      keyEpoch: w.keyEpoch,
      createdAt: w.createdAt.toISOString(),
    }));

    res.json(result);
  }),
);

// Resolve the message-body subset of a request into the columns we need for
// Prisma.create(). Accepts either a plaintext `content` field or a fully
// validated `envelope`. The validate() middleware has already guaranteed the
// shape matches one of these branches.
type MessageBody = { content: string } | { envelope: EncryptedEnvelope };
function bodyToMessageData(body: MessageBody) {
  if ('envelope' in body) return envelopeToCreateData(body.envelope);
  return {
    content: body.content,
    ciphertext: null,
    nonce: null,
    senderDeviceId: null,
    keyEpoch: null,
    protocolVersion: null,
  };
}

messageRoutes.post('/conversations', validate(startConversationSchema), asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  // Intersection gives us participantId plus either { message? } (plaintext,
  // backwards compat) or { envelope } (encrypted). Note: the plaintext field
  // is named `message` here for historical reasons, not `content`.
  const body = req.body as { participantId: string } & ({ message?: string } | { envelope: EncryptedEnvelope });
  const { participantId } = body;

  if (participantId === userId) throw new AppError(400, 'Cannot message yourself');

  const other = await prisma.user.findUnique({ where: { id: participantId } });
  if (!other) throw new AppError(404, 'User not found');

  // Normalize participant order for unique constraint
  const [aId, bId] = [userId, participantId].sort();

  let conversation = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: { participantAId: aId, participantBId: bId } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { participantAId: aId, participantBId: bId },
    });
  }

  // A starting message is optional. When present it can be either plaintext
  // (the legacy path; pre-Phase-2 clients still use this) or an encrypted
  // envelope (Phase 2 clients with E2EE on and a peer device available).
  const hasEnvelope = 'envelope' in body;
  const hasPlaintext = !hasEnvelope && typeof body.message === 'string' && body.message.length > 0;
  if (hasEnvelope || hasPlaintext) {
    const messageData = hasEnvelope
      ? envelopeToCreateData(body.envelope)
      : bodyToMessageData({ content: body.message! });

    const msg = await prisma.message.create({
      data: {
        ...messageData,
        senderId: userId,
        receiverId: participantId,
        conversationId: conversation.id,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    sendToUser(participantId, { type: 'NEW_MESSAGE', payload: toWireMessage(msg) });

    void notifyReceiver({
      messageId: msg.id,
      receiverId: participantId,
      senderId: userId,
      conversationId: conversation.id,
      content: notificationContent(msg),
    });
  }

  res.status(201).json(conversation);
}));

messageRoutes.post('/conversations/:id/messages', validate(sendMessageSchema), asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const body = req.body as MessageBody;
  const conv = await prisma.conversation.findUnique({
    where: { id: req.params.id as string },
  });
  if (!conv) throw new AppError(404, 'Conversation not found');
  if (conv.participantAId !== userId && conv.participantBId !== userId) {
    throw new AppError(403, 'Not authorized');
  }

  const receiverId = conv.participantAId === userId
    ? conv.participantBId
    : conv.participantAId;

  const message = await prisma.message.create({
    data: {
      ...bodyToMessageData(body),
      senderId: userId,
      receiverId,
      conversationId: conv.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { updatedAt: new Date() },
  });

  const wire = toWireMessage(message);
  sendToUser(receiverId, { type: 'NEW_MESSAGE', payload: wire });

  void notifyReceiver({
    messageId: message.id,
    receiverId,
    senderId: userId,
    conversationId: conv.id,
    content: notificationContent(message),
  });

  res.status(201).json(wire);
}));
