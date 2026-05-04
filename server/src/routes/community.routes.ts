import { Router } from 'express';
import { randomBytes } from 'crypto';
import {
  createCommunitySchema,
  updateCommunitySchema,
  inviteToCommunitySchema,
  updateMemberRoleSchema,
  communityJoinRequestSchema,
} from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { uploadAvatar } from '../middleware/upload.middleware.js';
import { prisma } from '../config/database.js';
import { deleteObjectByUrl } from '../config/storage.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUserSelect, memberInclude } from '../utils/prisma-selects.js';
import {
  sendCommunityJoinRequestEmail,
  sendCommunityJoinRequestApprovedEmail,
  sendCommunityInviteEmail,
  sendCommunitySignupInviteEmail,
} from '../services/mail.service.js';
import type { Prisma } from '@prisma/client';

async function notifyAdminsOfJoinRequest(params: {
  communityId: string;
  requesterId: string;
  message: string | null;
}): Promise<void> {
  try {
    const [community, requester, admins] = await Promise.all([
      prisma.community.findUnique({
        where: { id: params.communityId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: params.requesterId },
        select: { name: true },
      }),
      prisma.communityMember.findMany({
        where: {
          communityId: params.communityId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: {
          user: {
            select: { id: true, email: true, emailNotificationsEnabled: true, emailVerified: true },
          },
        },
      }),
    ]);
    if (!community || !requester) return;

    await Promise.all(
      admins
        .filter((m) => m.user.id !== params.requesterId)
        .filter((m) => m.user.emailNotificationsEnabled && m.user.emailVerified)
        .map((m) =>
          sendCommunityJoinRequestEmail(
            m.user.email,
            requester.name,
            community.name,
            params.communityId,
            params.message,
          ),
        ),
    );
  } catch (err) {
    console.error('[mail] failed to send community-join-request email', err);
  }
}

export const communityRoutes = Router();

communityRoutes.use(requireAuth);
communityRoutes.use(rejectBanned);

// ----- Listing & current-user invites -----

// GET /api/communities
communityRoutes.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { q, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

  const where: Prisma.CommunityWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q as string, mode: 'insensitive' } },
      { description: { contains: q as string, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.community.findMany({
      where,
      include: {
        _count: { select: { members: true } },
        members: { where: { userId: req.user!.id }, select: { role: true } },
        joinRequests: { where: { userId: req.user!.id, status: 'PENDING' }, select: { status: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.community.count({ where }),
  ]);

  const data = items.map(({ _count, members, joinRequests, ...c }) => ({
    ...c,
    memberCount: _count.members,
    myRole: members[0]?.role ?? null,
    myJoinRequestStatus: joinRequests[0]?.status ?? null,
  }));

  res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));

// GET /api/communities/mine
communityRoutes.get('/mine', asyncHandler(async (req: AuthRequest, res) => {
  const memberships = await prisma.communityMember.findMany({
    where: { userId: req.user!.id },
    include: { community: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: 'desc' },
  });

  const data = memberships.map((m) => ({
    ...m.community,
    memberCount: m.community._count.members,
    myRole: m.role,
    myJoinRequestStatus: null,
  }));
  res.json(data);
}));

// GET /api/communities/me/invites
communityRoutes.get('/me/invites', asyncHandler(async (req: AuthRequest, res) => {
  const invites = await prisma.communityInvite.findMany({
    where: { invitedUserId: req.user!.id, status: 'PENDING' },
    include: { community: true, invitedBy: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invites);
}));

// POST /api/communities/me/invites/:inviteId/accept
communityRoutes.post('/me/invites/:inviteId/accept', asyncHandler(async (req: AuthRequest, res) => {
  const invite = await prisma.communityInvite.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.invitedUserId !== req.user!.id) throw new AppError(404, 'Invite not found');
  if (invite.status !== 'PENDING') throw new AppError(400, 'Invite is no longer pending');

  await prisma.$transaction([
    prisma.communityMember.create({ data: { communityId: invite.communityId, userId: req.user!.id, role: 'MEMBER' } }),
    prisma.communityInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } }),
  ]);
  res.json({ message: 'Invite accepted' });
}));

// POST /api/communities/me/invites/:inviteId/decline
communityRoutes.post('/me/invites/:inviteId/decline', asyncHandler(async (req: AuthRequest, res) => {
  const invite = await prisma.communityInvite.findUnique({ where: { id: req.params.inviteId as string } });
  if (!invite || invite.invitedUserId !== req.user!.id) throw new AppError(404, 'Invite not found');
  if (invite.status !== 'PENDING') throw new AppError(400, 'Invite is no longer pending');

  await prisma.communityInvite.update({ where: { id: invite.id }, data: { status: 'DECLINED' } });
  res.json({ message: 'Invite declined' });
}));

// ----- Community CRUD -----

// POST /api/communities
communityRoutes.post('/', validate(createCommunitySchema), asyncHandler(async (req: AuthRequest, res) => {
  const community = await prisma.community.create({
    data: {
      ...req.body,
      members: { create: { userId: req.user!.id, role: 'OWNER' } },
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: req.user!.id }, select: { role: true } },
    },
  });

  const { _count, members, ...rest } = community;
  res.status(201).json({ ...rest, memberCount: _count.members, myRole: members[0]?.role ?? null });
}));

// GET /api/communities/:id
communityRoutes.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const community = await prisma.community.findUnique({
    where: { id: req.params.id as string },
    include: {
      _count: { select: { members: true } },
      members: { include: memberInclude, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] },
      joinRequests: { where: { userId: req.user!.id, status: 'PENDING' }, select: { status: true }, take: 1 },
    },
  });
  if (!community) throw new AppError(404, 'Community not found');

  const myMembership = community.members.find((m) => m.userId === req.user!.id);
  const { _count, members, joinRequests, ...rest } = community;
  res.json({
    ...rest,
    memberCount: _count.members,
    myRole: myMembership?.role ?? null,
    myJoinRequestStatus: joinRequests[0]?.status ?? null,
    members,
  });
}));

// PATCH /api/communities/:id
communityRoutes.patch('/:id', validate(updateCommunitySchema), asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }
  const { name, description, location, latitude, longitude } = req.body;
  const updated = await prisma.community.update({ where: { id: cid }, data: { name, description, location, latitude, longitude } });
  res.json(updated);
}));

// POST /api/communities/:id/avatar — upload a new avatar (OWNER/ADMIN)
communityRoutes.post('/:id/avatar', uploadAvatar, asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }
  const file = req.file as Express.MulterS3.File | undefined;
  if (!file) throw new AppError(400, 'No file uploaded');

  const existing = await prisma.community.findUnique({
    where: { id: cid },
    select: { avatarUrl: true },
  });

  const updated = await prisma.community.update({
    where: { id: cid },
    data: { avatarUrl: file.location },
  });

  if (existing?.avatarUrl) {
    await deleteObjectByUrl(existing.avatarUrl).catch(() => {});
  }

  res.json(updated);
}));

// DELETE /api/communities/:id
communityRoutes.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || membership.role !== 'OWNER') {
    throw new AppError(403, 'Only the owner can delete the community');
  }

  // Detach posts — make them public rather than deleting them
  await prisma.post.updateMany({ where: { communityId: cid }, data: { communityId: null } });
  await prisma.community.delete({ where: { id: cid } });
  res.json({ message: 'Community deleted' });
}));

// ----- Members -----

communityRoutes.get('/:id/members', asyncHandler(async (req: AuthRequest, res) => {
  const members = await prisma.communityMember.findMany({
    where: { communityId: req.params.id as string },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  res.json(members);
}));

communityRoutes.patch('/:id/members/:userId', validate(updateMemberRoleSchema), asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const targetUserId = req.params.userId as string;

  const myMembership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!myMembership || myMembership.role !== 'OWNER') {
    throw new AppError(403, 'Only the owner can change roles');
  }
  if (targetUserId === req.user!.id) throw new AppError(400, 'Cannot change your own role');

  const updated = await prisma.communityMember.update({
    where: { communityId_userId: { communityId: cid, userId: targetUserId } },
    data: { role: req.body.role },
    include: memberInclude,
  });
  res.json(updated);
}));

communityRoutes.delete('/:id/members/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const isSelf = targetUserId === req.user!.id;

  const myMembership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!myMembership) throw new AppError(403, 'Not a member of this community');

  const targetMembership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: targetUserId } },
  });
  if (!targetMembership) throw new AppError(404, 'Member not found');

  if (!isSelf) {
    if (myMembership.role !== 'OWNER' && myMembership.role !== 'ADMIN') {
      throw new AppError(403, 'Not authorized to remove members');
    }
    if (targetMembership.role === 'OWNER') throw new AppError(403, 'Cannot remove the owner');
    if (targetMembership.role === 'ADMIN' && myMembership.role !== 'OWNER') {
      throw new AppError(403, 'Only the owner can remove admins');
    }
  } else if (myMembership.role === 'OWNER') {
    throw new AppError(400, 'Owners cannot leave; transfer ownership or delete the community');
  }

  await prisma.communityMember.delete({
    where: { communityId_userId: { communityId: cid, userId: targetUserId } },
  });
  res.json({ message: isSelf ? 'Left community' : 'Member removed' });
}));

// ----- Invites (community-side) -----

communityRoutes.get('/:id/invites', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const invites = await prisma.communityInvite.findMany({
    where: { communityId: cid, status: 'PENDING' },
    include: { invitedUser: { select: publicUserSelect }, invitedBy: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invites);
}));

communityRoutes.post('/:id/invites', validate(inviteToCommunitySchema), asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized to invite');
  }

  const targetUser = await prisma.user.findUnique({ where: { email: req.body.email }, select: { id: true } });
  if (!targetUser) {
    const community = await prisma.community.findUnique({ where: { id: cid }, select: { name: true } });
    if (!community) throw new AppError(404, 'Community not found');
    const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });

    const normalizedEmail = req.body.email.trim().toLowerCase();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.pendingCommunityInvite.upsert({
      where: { communityId_email: { communityId: cid, email: normalizedEmail } },
      create: {
        communityId: cid,
        email: normalizedEmail,
        invitedById: req.user!.id,
        token,
        expiresAt,
      },
      update: {
        invitedById: req.user!.id,
        token,
        expiresAt,
        status: 'PENDING',
        claimedAt: null,
      },
    });

    try {
      await sendCommunitySignupInviteEmail(
        normalizedEmail,
        inviter?.name ?? 'A Mayday member',
        community.name,
        token,
      );
    } catch (err) {
      console.error('[mail] failed to send community-signup-invite email', err);
    }
    res.status(202).json({ pendingSignup: true, email: normalizedEmail });
    return;
  }

  const existingMember = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: targetUser.id } },
  });
  if (existingMember) throw new AppError(409, 'User is already a member');

  const existingInvite = await prisma.communityInvite.findUnique({
    where: { communityId_invitedUserId: { communityId: cid, invitedUserId: targetUser.id } },
  });

  let invite;
  if (existingInvite) {
    if (existingInvite.status === 'PENDING') throw new AppError(409, 'An invite is already pending for this user');
    invite = await prisma.communityInvite.update({
      where: { id: existingInvite.id },
      data: { status: 'PENDING', invitedById: req.user!.id },
      include: { invitedUser: { select: publicUserSelect }, invitedBy: { select: publicUserSelect } },
    });
  } else {
    invite = await prisma.communityInvite.create({
      data: { communityId: cid, invitedUserId: targetUser.id, invitedById: req.user!.id },
      include: { invitedUser: { select: publicUserSelect }, invitedBy: { select: publicUserSelect } },
    });
  }

  void (async () => {
    try {
      const [community, recipient, inviter] = await Promise.all([
        prisma.community.findUnique({ where: { id: cid }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: targetUser.id },
          select: { email: true, emailNotificationsEnabled: true, emailVerified: true },
        }),
        prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }),
      ]);
      if (
        community &&
        recipient &&
        inviter &&
        recipient.emailNotificationsEnabled &&
        recipient.emailVerified
      ) {
        await sendCommunityInviteEmail(recipient.email, inviter.name, community.name);
      }
    } catch (err) {
      console.error('[mail] failed to send community-invite email', err);
    }
  })();

  res.status(201).json(invite);
}));

communityRoutes.delete('/:id/invites/:inviteId', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const inviteId = req.params.inviteId as string;

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const invite = await prisma.communityInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.communityId !== cid) throw new AppError(404, 'Invite not found');
  if (invite.status !== 'PENDING') throw new AppError(400, 'Invite is no longer pending');

  await prisma.communityInvite.update({ where: { id: inviteId }, data: { status: 'REVOKED' } });
  res.json({ message: 'Invite revoked' });
}));

// ----- Join requests -----

// POST /api/communities/:id/join-requests  — user requests to join
communityRoutes.post('/:id/join-requests', validate(communityJoinRequestSchema), asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const userId = req.user!.id;

  const community = await prisma.community.findUnique({ where: { id: cid } });
  if (!community) throw new AppError(404, 'Community not found');

  const existingMember = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId } },
  });
  if (existingMember) throw new AppError(409, 'You are already a member');

  const existing = await prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId: cid, userId } },
  });

  let request;
  if (existing) {
    if (existing.status === 'PENDING') throw new AppError(409, 'You already have a pending request');
    // Re-submit a previously declined/revoked request
    request = await prisma.communityJoinRequest.update({
      where: { id: existing.id },
      data: { status: 'PENDING', message: req.body.message ?? null },
    });
  } else {
    request = await prisma.communityJoinRequest.create({
      data: { communityId: cid, userId, message: req.body.message ?? null },
    });
  }

  void notifyAdminsOfJoinRequest({
    communityId: cid,
    requesterId: userId,
    message: request.message,
  });

  res.status(201).json(request);
}));

// DELETE /api/communities/:id/join-requests  — user withdraws their own request
communityRoutes.delete('/:id/join-requests', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const userId = req.user!.id;

  const request = await prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId: cid, userId } },
  });
  if (!request || request.status !== 'PENDING') throw new AppError(404, 'No pending request found');

  await prisma.communityJoinRequest.update({
    where: { id: request.id },
    data: { status: 'REVOKED' },
  });
  res.json({ message: 'Request withdrawn' });
}));

// GET /api/communities/:id/join-requests  — OWNER/ADMIN lists pending requests
communityRoutes.get('/:id/join-requests', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const requests = await prisma.communityJoinRequest.findMany({
    where: { communityId: cid, status: 'PENDING' },
    include: { user: { select: publicUserSelect } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(requests);
}));

// POST /api/communities/:id/join-requests/:requestId/approve
communityRoutes.post('/:id/join-requests/:requestId/approve', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const requestId = req.params.requestId as string;

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const joinReq = await prisma.communityJoinRequest.findUnique({ where: { id: requestId } });
  if (!joinReq || joinReq.communityId !== cid) throw new AppError(404, 'Request not found');
  if (joinReq.status !== 'PENDING') throw new AppError(400, 'Request is no longer pending');

  await prisma.$transaction([
    prisma.communityMember.create({ data: { communityId: cid, userId: joinReq.userId, role: 'MEMBER' } }),
    prisma.communityJoinRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
  ]);

  void (async () => {
    try {
      const [community, requester] = await Promise.all([
        prisma.community.findUnique({ where: { id: cid }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: joinReq.userId },
          select: { email: true, emailNotificationsEnabled: true, emailVerified: true },
        }),
      ]);
      if (
        community &&
        requester &&
        requester.emailNotificationsEnabled &&
        requester.emailVerified
      ) {
        await sendCommunityJoinRequestApprovedEmail(requester.email, community.name, cid);
      }
    } catch (err) {
      console.error('[mail] failed to send community-join-approved email', err);
    }
  })();

  res.json({ message: 'Request approved' });
}));

// POST /api/communities/:id/join-requests/:requestId/reject
communityRoutes.post('/:id/join-requests/:requestId/reject', asyncHandler(async (req: AuthRequest, res) => {
  const cid = req.params.id as string;
  const requestId = req.params.requestId as string;

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: cid, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const joinReq = await prisma.communityJoinRequest.findUnique({ where: { id: requestId } });
  if (!joinReq || joinReq.communityId !== cid) throw new AppError(404, 'Request not found');
  if (joinReq.status !== 'PENDING') throw new AppError(400, 'Request is no longer pending');

  await prisma.communityJoinRequest.update({ where: { id: requestId }, data: { status: 'DECLINED' } });
  res.json({ message: 'Request rejected' });
}));
