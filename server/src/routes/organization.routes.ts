import { Router } from 'express';
import { randomBytes } from 'crypto';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteToOrganizationSchema,
  updateMemberRoleSchema,
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
  sendOrganizationInviteEmail,
  sendOrganizationSignupInviteEmail,
} from '../services/mail.service.js';
import { postInclude } from './post.routes.js';
import type { Prisma } from '@prisma/client';

export const organizationRoutes = Router();

// All organization routes require authentication
organizationRoutes.use(requireAuth);
organizationRoutes.use(rejectBanned);

// ----- Org listing & current-user invites -----

// GET /api/organizations — list organizations (paginated, searchable)
organizationRoutes.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { q, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

  const where: Prisma.OrganizationWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q as string, mode: 'insensitive' } },
      { description: { contains: q as string, mode: 'insensitive' } },
    ];
  }

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        _count: { select: { members: true } },
        members: { where: { userId: req.user!.id }, select: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.organization.count({ where }),
  ]);

  const data = orgs.map(({ _count, members, ...org }) => ({
    ...org,
    memberCount: _count.members,
    myRole: members[0]?.role ?? null,
  }));

  res.json({
    data,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  });
}));

// GET /api/organizations/mine — list organizations the current user is a member of
organizationRoutes.get('/mine', asyncHandler(async (req: AuthRequest, res) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.user!.id },
    include: {
      organization: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const data = memberships.map((m) => ({
    ...m.organization,
    memberCount: m.organization._count.members,
    myRole: m.role,
  }));

  res.json(data);
}));

// GET /api/organizations/me/invites — list current user's pending invites
organizationRoutes.get('/me/invites', asyncHandler(async (req: AuthRequest, res) => {
  const invites = await prisma.organizationInvite.findMany({
    where: { invitedUserId: req.user!.id, status: 'PENDING' },
    include: {
      organization: true,
      invitedBy: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invites);
}));

// POST /api/organizations/me/invites/:inviteId/accept
organizationRoutes.post('/me/invites/:inviteId/accept', asyncHandler(async (req: AuthRequest, res) => {
  const invite = await prisma.organizationInvite.findUnique({
    where: { id: req.params.inviteId as string },
  });
  if (!invite || invite.invitedUserId !== req.user!.id) {
    throw new AppError(404, 'Invite not found');
  }
  if (invite.status !== 'PENDING') {
    throw new AppError(400, 'Invite is no longer pending');
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId: req.user!.id,
        role: 'MEMBER',
      },
    }),
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    }),
  ]);

  res.json({ message: 'Invite accepted' });
}));

// POST /api/organizations/me/invites/:inviteId/decline
organizationRoutes.post('/me/invites/:inviteId/decline', asyncHandler(async (req: AuthRequest, res) => {
  const invite = await prisma.organizationInvite.findUnique({
    where: { id: req.params.inviteId as string },
  });
  if (!invite || invite.invitedUserId !== req.user!.id) {
    throw new AppError(404, 'Invite not found');
  }
  if (invite.status !== 'PENDING') {
    throw new AppError(400, 'Invite is no longer pending');
  }

  await prisma.organizationInvite.update({
    where: { id: invite.id },
    data: { status: 'DECLINED' },
  });

  res.json({ message: 'Invite declined' });
}));

// ----- Organization CRUD -----

// POST /api/organizations — create org (creator becomes OWNER)
organizationRoutes.post('/', validate(createOrganizationSchema), asyncHandler(async (req: AuthRequest, res) => {
  const org = await prisma.organization.create({
    data: {
      ...req.body,
      members: {
        create: { userId: req.user!.id, role: 'OWNER' },
      },
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: req.user!.id }, select: { role: true } },
    },
  });

  const { _count, members, ...rest } = org;
  res.status(201).json({
    ...rest,
    memberCount: _count.members,
    myRole: members[0]?.role ?? null,
  });
}));

// GET /api/organizations/:id — org detail with members
organizationRoutes.get('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const [org, fulfilledCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: memberInclude,
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
      },
    }),
    prisma.postFulfillment.count({
      where: { organizationId: orgId, post: { type: 'REQUEST' } },
    }),
  ]);
  if (!org) throw new AppError(404, 'Organization not found');

  const myMembership = org.members.find((m) => m.userId === req.user!.id);
  const { _count, members, ...rest } = org;

  res.json({
    ...rest,
    memberCount: _count.members,
    myRole: myMembership?.role ?? null,
    fulfilledCount,
    members,
  });
}));

// PATCH /api/organizations/:id — edit (OWNER/ADMIN)
organizationRoutes.patch('/:id', validate(updateOrganizationSchema), asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const { name, description, location, latitude, longitude } = req.body;
  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { name, description, location, latitude, longitude },
  });
  res.json(org);
}));

// POST /api/organizations/:id/avatar — upload a new avatar (OWNER/ADMIN)
organizationRoutes.post('/:id/avatar', uploadAvatar, asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }
  const file = req.file as Express.MulterS3.File | undefined;
  if (!file) throw new AppError(400, 'No file uploaded');

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { avatarUrl: true },
  });

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { avatarUrl: file.location },
  });

  if (existing?.avatarUrl) {
    await deleteObjectByUrl(existing.avatarUrl).catch(() => {});
  }

  res.json(org);
}));

// DELETE /api/organizations/:id — delete (OWNER only)
organizationRoutes.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || membership.role !== 'OWNER') {
    throw new AppError(403, 'Only the owner can delete the organization');
  }

  // Detach posts (keep them, just remove org link)
  await prisma.post.updateMany({
    where: { organizationId: orgId },
    data: { organizationId: null },
  });
  await prisma.organization.delete({ where: { id: orgId } });
  res.json({ message: 'Organization deleted' });
}));

// GET /api/organizations/:id/posts — list posts authored on behalf of the org
organizationRoutes.get('/:id/posts', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const where: Prisma.PostWhereInput = { organizationId: orgId };

  // Hide community posts the viewer isn't a member of (site ADMINs see everything)
  if (req.user!.role !== 'ADMIN') {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: req.user!.id },
      select: { communityId: true },
    });
    const myCommunityIds = memberships.map((m) => m.communityId);
    where.OR = myCommunityIds.length > 0
      ? [{ communityId: null }, { communityId: { in: myCommunityIds } }]
      : [{ communityId: null }];
  }

  const [data, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// ----- Members -----

// GET /api/organizations/:id/members — list members
organizationRoutes.get('/:id/members', asyncHandler(async (req: AuthRequest, res) => {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: req.params.id as string },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  res.json(members);
}));

// PATCH /api/organizations/:id/members/:userId — change role (OWNER only)
organizationRoutes.patch('/:id/members/:userId', validate(updateMemberRoleSchema), asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const targetUserId = req.params.userId as string;

  const myMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!myMembership || myMembership.role !== 'OWNER') {
    throw new AppError(403, 'Only the owner can change member roles');
  }
  if (targetUserId === req.user!.id) {
    throw new AppError(400, 'Cannot change your own role');
  }

  const updated = await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    data: { role: req.body.role },
    include: memberInclude,
  });
  res.json(updated);
}));

// DELETE /api/organizations/:id/members/:userId — remove member (OWNER/ADMIN, or self to leave)
organizationRoutes.delete('/:id/members/:userId', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const isSelf = targetUserId === req.user!.id;

  const myMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!myMembership) throw new AppError(403, 'Not a member of this organization');

  const targetMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });
  if (!targetMembership) throw new AppError(404, 'Member not found');

  // Authorization
  if (!isSelf) {
    if (myMembership.role !== 'OWNER' && myMembership.role !== 'ADMIN') {
      throw new AppError(403, 'Not authorized to remove members');
    }
    if (targetMembership.role === 'OWNER') {
      throw new AppError(403, 'Cannot remove the owner');
    }
    if (targetMembership.role === 'ADMIN' && myMembership.role !== 'OWNER') {
      throw new AppError(403, 'Only the owner can remove other admins');
    }
  } else if (myMembership.role === 'OWNER') {
    throw new AppError(400, 'Owners cannot leave; transfer ownership or delete the organization');
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });
  res.json({ message: isSelf ? 'Left organization' : 'Member removed' });
}));

// ----- Invites (org-side) -----

// GET /api/organizations/:id/invites — list pending invites for an org (OWNER/ADMIN)
organizationRoutes.get('/:id/invites', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const invites = await prisma.organizationInvite.findMany({
    where: { organizationId: orgId, status: 'PENDING' },
    include: {
      invitedUser: { select: publicUserSelect },
      invitedBy: { select: publicUserSelect },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invites);
}));

// POST /api/organizations/:id/invites — invite user by email (OWNER/ADMIN)
organizationRoutes.post('/:id/invites', validate(inviteToOrganizationSchema), asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized to invite');
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: req.body.email },
    select: { id: true },
  });
  if (!targetUser) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!org) throw new AppError(404, 'Organization not found');
    const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });

    const normalizedEmail = req.body.email.trim().toLowerCase();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.pendingOrganizationInvite.upsert({
      where: { organizationId_email: { organizationId: orgId, email: normalizedEmail } },
      create: {
        organizationId: orgId,
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
      await sendOrganizationSignupInviteEmail(
        normalizedEmail,
        inviter?.name ?? 'A Mayday member',
        org.name,
        token,
      );
    } catch (err) {
      console.error('[mail] failed to send organization-signup-invite email', err);
    }
    res.status(202).json({ pendingSignup: true, email: normalizedEmail });
    return;
  }

  // Already a member?
  const existingMember = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUser.id } },
  });
  if (existingMember) throw new AppError(409, 'User is already a member');

  // Pending invite?
  const existingInvite = await prisma.organizationInvite.findUnique({
    where: { organizationId_invitedUserId: { organizationId: orgId, invitedUserId: targetUser.id } },
  });

  let invite;
  if (existingInvite) {
    if (existingInvite.status === 'PENDING') {
      throw new AppError(409, 'An invite is already pending for this user');
    }
    // Reactivate prior invite (DECLINED / REVOKED / ACCEPTED-then-removed)
    invite = await prisma.organizationInvite.update({
      where: { id: existingInvite.id },
      data: { status: 'PENDING', invitedById: req.user!.id },
      include: {
        invitedUser: { select: publicUserSelect },
        invitedBy: { select: publicUserSelect },
      },
    });
  } else {
    invite = await prisma.organizationInvite.create({
      data: {
        organizationId: orgId,
        invitedUserId: targetUser.id,
        invitedById: req.user!.id,
      },
      include: {
        invitedUser: { select: publicUserSelect },
        invitedBy: { select: publicUserSelect },
      },
    });
  }

  void (async () => {
    try {
      const [org, recipient, inviter] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.user.findUnique({
          where: { id: targetUser.id },
          select: { email: true, emailNotificationsEnabled: true, emailVerified: true },
        }),
        prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }),
      ]);
      if (
        org &&
        recipient &&
        inviter &&
        recipient.emailNotificationsEnabled &&
        recipient.emailVerified
      ) {
        await sendOrganizationInviteEmail(recipient.email, inviter.name, org.name);
      }
    } catch (err) {
      console.error('[mail] failed to send organization-invite email', err);
    }
  })();

  res.status(201).json(invite);
}));

// DELETE /api/organizations/:id/invites/:inviteId — revoke invite (OWNER/ADMIN)
organizationRoutes.delete('/:id/invites/:inviteId', asyncHandler(async (req: AuthRequest, res) => {
  const orgId = req.params.id as string;
  const inviteId = req.params.inviteId as string;

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } },
  });
  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new AppError(403, 'Not authorized');
  }

  const invite = await prisma.organizationInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== orgId) throw new AppError(404, 'Invite not found');
  if (invite.status !== 'PENDING') throw new AppError(400, 'Invite is no longer pending');

  await prisma.organizationInvite.update({
    where: { id: inviteId },
    data: { status: 'REVOKED' },
  });
  res.json({ message: 'Invite revoked' });
}));
