import { Router } from 'express';
import { sendMessageSchema, startConversationSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { sendToUser } from '../websocket/index.js';
import { sendNewMessageEmail } from '../services/mail.service.js';

async function notifyReceiverByEmail(params: {
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

    const [receiver, sender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.receiverId },
        select: { email: true, emailNotificationsEnabled: true, emailVerified: true },
      }),
      prisma.user.findUnique({
        where: { id: params.senderId },
        select: { name: true },
      }),
    ]);
    if (!receiver || !sender) return;
    if (!receiver.emailNotificationsEnabled) return;
    if (!receiver.emailVerified) return;

    await sendNewMessageEmail(receiver.email, sender.name, params.content);
  } catch (err) {
    console.error('[mail] failed to send new-message email', err);
  }
}

export const messageRoutes = Router();

messageRoutes.use(requireAuth);
messageRoutes.use(rejectBanned);

messageRoutes.get('/conversations', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participantAId: userId },
          { participantBId: userId },
        ],
      },
      include: {
        participantA: { select: { id: true, name: true, bio: true, location: true, skills: true, avatarUrl: true, createdAt: true } },
        participantB: { select: { id: true, name: true, bio: true, location: true, skills: true, avatarUrl: true, createdAt: true } },
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
  } catch (err) { next(err); }
});

messageRoutes.get('/conversations/:id', async (req: AuthRequest, res, next) => {
  try {
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

    res.json(messages.reverse());
  } catch (err) { next(err); }
});

messageRoutes.post('/conversations', validate(startConversationSchema), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { participantId, message } = req.body;

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

    if (message) {
      const msg = await prisma.message.create({
        data: {
          content: message,
          senderId: userId,
          receiverId: participantId,
          conversationId: conversation.id,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      sendToUser(participantId, { type: 'NEW_MESSAGE', payload: msg as any });

      void notifyReceiverByEmail({
        messageId: msg.id,
        receiverId: participantId,
        senderId: userId,
        conversationId: conversation.id,
        content: msg.content,
      });
    }

    res.status(201).json(conversation);
  } catch (err) { next(err); }
});

messageRoutes.post('/conversations/:id/messages', validate(sendMessageSchema), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
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
        content: req.body.content,
        senderId: userId,
        receiverId,
        conversationId: conv.id,
      },
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    sendToUser(receiverId, { type: 'NEW_MESSAGE', payload: message as any });

    void notifyReceiverByEmail({
      messageId: message.id,
      receiverId,
      senderId: userId,
      conversationId: conv.id,
      content: message.content,
    });

    res.status(201).json(message);
  } catch (err) { next(err); }
});
