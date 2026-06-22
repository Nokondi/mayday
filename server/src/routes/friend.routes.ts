import { Router } from 'express';
import { sendFriendRequestSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUserSelect } from '../utils/prisma-selects.js';
import { notify } from '../services/notification.service.js';
import { orderedPair, areFriends } from '../services/friend.service.js';
import { createInviteMessage, setInviteMessageStatus } from './message.routes.js';

export const friendRoutes = Router();

friendRoutes.use(requireAuth);
friendRoutes.use(rejectBanned);

// Turn senderId/recipientId into a friendship and mark the request accepted, in
// one transaction. Idempotent on the friendship (upsert) so a double-accept or a
// reverse-direction request that's auto-accepted can't violate the unique pair.
async function establishFriendship(requestId: string, senderId: string, recipientId: string) {
  const pair = orderedPair(senderId, recipientId);
  await prisma.$transaction([
    prisma.friendship.upsert({
      where: { userAId_userBId: pair },
      create: pair,
      update: {},
    }),
    prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    }),
  ]);
}

// POST /api/friends/requests — send a friend request to another user.
friendRoutes.post(
  '/requests',
  validate(sendFriendRequestSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const senderId = req.user!.id;
    const recipientId = (req.body as { userId: string }).userId;

    if (recipientId === senderId) {
      throw new AppError(400, "You can't send a friend request to yourself");
    }

    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } }),
    ]);
    if (!recipient) throw new AppError(404, 'User not found');

    if (await areFriends(senderId, recipientId)) {
      throw new AppError(400, 'You are already friends');
    }

    // If they already sent us a pending request, accept it instead of creating a
    // mirror request — covers the "both tap Add friend" case cleanly.
    const reverse = await prisma.friendRequest.findUnique({
      where: { senderId_recipientId: { senderId: recipientId, recipientId: senderId } },
    });
    if (reverse?.status === 'PENDING') {
      await establishFriendship(reverse.id, recipientId, senderId);
      await setInviteMessageStatus(reverse.requestMessageId, 'ACCEPTED');
      await notify(recipientId, {
        type: 'FRIEND_REQUEST_ACCEPTED',
        accepterId: senderId,
        accepterName: sender!.name,
      });
      res.status(201).json({ status: 'ACCEPTED' });
      return;
    }

    // Upsert resets a prior DECLINED/REVOKED request back to PENDING so users can
    // try again after a rejection.
    const request = await prisma.friendRequest.upsert({
      where: { senderId_recipientId: { senderId, recipientId } },
      create: { senderId, recipientId, status: 'PENDING' },
      update: { status: 'PENDING', requestMessageId: null },
    });

    const card = await createInviteMessage({
      inviterId: senderId,
      inviteeId: recipientId,
      metadata: {
        inviteKind: 'FRIEND',
        inviteId: request.id,
        targetId: senderId, // links the recipient's card to the requester's profile
        targetName: sender!.name,
        status: 'PENDING',
      },
    });
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { requestMessageId: card.id },
    });

    await notify(recipientId, {
      type: 'FRIEND_REQUEST',
      senderId,
      senderName: sender!.name,
    });

    res.status(201).json({ status: 'PENDING' });
  }),
);

// GET /api/friends/me/requests — current user's pending incoming requests.
friendRoutes.get(
  '/me/requests',
  asyncHandler(async (req: AuthRequest, res) => {
    const requests = await prisma.friendRequest.findMany({
      where: { recipientId: req.user!.id, status: 'PENDING' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        sender: { select: publicUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  }),
);

// POST /api/friends/me/requests/:id/accept
friendRoutes.post(
  '/me/requests/:id/accept',
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await prisma.friendRequest.findUnique({
      where: { id: req.params.id as string },
    });
    if (!request || request.recipientId !== req.user!.id) {
      throw new AppError(404, 'Friend request not found');
    }
    if (request.status !== 'PENDING') {
      throw new AppError(400, 'Request is no longer pending');
    }

    await establishFriendship(request.id, request.senderId, request.recipientId);
    await setInviteMessageStatus(request.requestMessageId, 'ACCEPTED');

    const accepter = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });
    await notify(request.senderId, {
      type: 'FRIEND_REQUEST_ACCEPTED',
      accepterId: req.user!.id,
      accepterName: accepter!.name,
    });

    res.json({ message: 'Friend request accepted' });
  }),
);

// POST /api/friends/me/requests/:id/decline
friendRoutes.post(
  '/me/requests/:id/decline',
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await prisma.friendRequest.findUnique({
      where: { id: req.params.id as string },
    });
    if (!request || request.recipientId !== req.user!.id) {
      throw new AppError(404, 'Friend request not found');
    }
    if (request.status !== 'PENDING') {
      throw new AppError(400, 'Request is no longer pending');
    }

    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED' },
    });
    await setInviteMessageStatus(request.requestMessageId, 'DECLINED');

    res.json({ message: 'Friend request declined' });
  }),
);

// DELETE /api/friends/requests/:id — sender cancels their own pending request.
// Registered before /:userId so a real userId never shadows the literal "requests".
friendRoutes.delete(
  '/requests/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const request = await prisma.friendRequest.findUnique({
      where: { id: req.params.id as string },
    });
    if (!request || request.senderId !== req.user!.id) {
      throw new AppError(404, 'Friend request not found');
    }
    if (request.status !== 'PENDING') {
      throw new AppError(400, 'Request is no longer pending');
    }

    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'REVOKED' },
    });
    await setInviteMessageStatus(request.requestMessageId, 'REVOKED');

    res.json({ message: 'Friend request withdrawn' });
  }),
);

// DELETE /api/friends/:userId — remove an existing friendship (unfriend).
friendRoutes.delete(
  '/:userId',
  asyncHandler(async (req: AuthRequest, res) => {
    const pair = orderedPair(req.user!.id, req.params.userId as string);
    await prisma.friendship.deleteMany({ where: pair });
    res.json({ message: 'Friend removed' });
  }),
);
