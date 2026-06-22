import { Router } from 'express';
import {
  updateProfileSchema,
  updateUserSettingsSchema,
  deleteAccountSchema,
  type OwnedGroupsResponse,
  type OwnedGroupSummary,
} from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { uploadAvatar } from '../middleware/upload.middleware.js';
import { prisma } from '../config/database.js';
import { deleteObjectByUrl } from '../config/storage.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicUserSelect } from '../utils/prisma-selects.js';
import { postInclude, serializePost } from './post.routes.js';
import type { Prisma } from '@prisma/client';

export const userRoutes = Router();

// GET /api/users/me/owned-groups — communities/orgs the current user owns,
// plus the candidates that could inherit ownership when their account is deleted.
// Drives the heir-picker UI in the danger-zone delete flow.
userRoutes.get('/me/owned-groups', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  const [ownedCommunities, ownedOrgs] = await Promise.all([
    prisma.communityMember.findMany({
      where: { userId, role: 'OWNER' },
      select: {
        community: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.organizationMember.findMany({
      where: { userId, role: 'OWNER' },
      select: {
        organization: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

  async function summarizeCommunity(
    c: { id: string; name: string; avatarUrl: string | null },
  ): Promise<OwnedGroupSummary> {
    const candidates = await prisma.communityMember.findMany({
      where: { communityId: c.id, userId: { not: userId } },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl,
      defaultHeirUserId: candidates[0]?.userId ?? null,
      candidates: candidates.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role as 'ADMIN' | 'MEMBER',
      })),
    };
  }

  async function summarizeOrg(
    o: { id: string; name: string; avatarUrl: string | null },
  ): Promise<OwnedGroupSummary> {
    const candidates = await prisma.organizationMember.findMany({
      where: { organizationId: o.id, userId: { not: userId } },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return {
      id: o.id,
      name: o.name,
      avatarUrl: o.avatarUrl,
      defaultHeirUserId: candidates[0]?.userId ?? null,
      candidates: candidates.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role as 'ADMIN' | 'MEMBER',
      })),
    };
  }

  const response: OwnedGroupsResponse = {
    communities: await Promise.all(ownedCommunities.map((m) => summarizeCommunity(m.community))),
    organizations: await Promise.all(ownedOrgs.map((m) => summarizeOrg(m.organization))),
  };

  res.json(response);
}));

// PUT /api/users/me/settings — update private settings for the current user
userRoutes.put('/me/settings', requireAuth, validate(updateUserSettingsSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { emailNotificationsEnabled, pushNotificationsEnabled } = req.body as {
    emailNotificationsEnabled?: boolean;
    pushNotificationsEnabled?: boolean;
  };
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { emailNotificationsEnabled, pushNotificationsEnabled },
    select: { id: true, emailNotificationsEnabled: true, pushNotificationsEnabled: true },
  });
  res.json(user);
}));

userRoutes.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const [user, fulfilledCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    }),
    prisma.postFulfillment.count({
      where: { userId: id, post: { type: 'REQUEST' } },
    }),
  ]);
  if (!user) throw new AppError(404, 'User not found');
  res.json({ ...user, fulfilledCount });
}));

userRoutes.put('/:id', requireAuth, validate(updateProfileSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (req.params.id as string !== req.user!.id) {
    throw new AppError(403, 'Not authorized');
  }

  const { name, bio, location, latitude, longitude, skills, links } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { name, bio, location, latitude, longitude, skills, links },
    select: {
      id: true, email: true, name: true, bio: true,
      location: true, latitude: true, longitude: true,
      skills: true, avatarUrl: true, links: true, role: true, createdAt: true,
    },
  });
  res.json(user);
}));

// Upload a new avatar for the authenticated user
userRoutes.post('/:id/avatar', requireAuth, uploadAvatar, asyncHandler(async (req: AuthRequest, res) => {
  if (req.params.id !== req.user!.id) {
    throw new AppError(403, 'Not authorized');
  }
  const file = req.file as Express.MulterS3.File | undefined;
  if (!file) throw new AppError(400, 'No file uploaded');

  const existing = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: { avatarUrl: true },
  });

  const [user, fulfilledCount] = await Promise.all([
    prisma.user.update({
      where: { id: req.params.id as string },
      data: { avatarUrl: file.location },
      select: publicUserSelect,
    }),
    prisma.postFulfillment.count({
      where: { userId: req.params.id as string, post: { type: 'REQUEST' } },
    }),
  ]);

  // Delete old avatar from Spaces (after successful update)
  if (existing?.avatarUrl) {
    await deleteObjectByUrl(existing.avatarUrl).catch(() => {});
  }

  res.json({ ...user, fulfilledCount });
}));

// DELETE /api/users/:id — self-service account deletion.
// Body (optional): { communityHeirs?: Record<communityId, userId>,
//                    organizationHeirs?: Record<organizationId, userId> }.
// Explicit heir picks must reference an existing member of the relevant group;
// any owned group not listed falls back to the oldest ADMIN (else oldest MEMBER).
//
// In a single transaction:
//   - owned communities/orgs with other members: ownership transfers to the
//     caller-chosen heir (or auto-pick fallback)
//   - owned communities/orgs with no other members: deleted (posts are detached first)
//   - the user's posts, messages, conversations, reports, bug reports, and
//     sent invites are deleted to clear restrict-FK constraints
//   - the user is deleted; cascades clean up the rest (memberships, invites received, etc.)
userRoutes.delete('/:id', requireAuth, validate(deleteAccountSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (req.params.id !== req.user!.id) {
    throw new AppError(403, 'Not authorized');
  }
  const userId = req.user!.id;
  const { communityHeirs = {}, organizationHeirs = {} } = req.body as {
    communityHeirs?: Record<string, string>;
    organizationHeirs?: Record<string, string>;
  };

  const avatarUrl = (await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  }))?.avatarUrl;

  await prisma.$transaction(async (tx) => {
    // 1. Owned communities: transfer ownership or delete.
    const ownedCommunityIds = (await tx.communityMember.findMany({
      where: { userId, role: 'OWNER' },
      select: { communityId: true },
    })).map((m) => m.communityId);

    for (const communityId of ownedCommunityIds) {
      const pickedHeirId = communityHeirs[communityId];
      let heirUserId: string | undefined;

      if (pickedHeirId) {
        if (pickedHeirId === userId) {
          throw new AppError(400, 'Cannot designate yourself as heir');
        }
        const picked = await tx.communityMember.findUnique({
          where: { communityId_userId: { communityId, userId: pickedHeirId } },
        });
        if (!picked) {
          throw new AppError(400, 'Designated heir is not a member of the community');
        }
        heirUserId = pickedHeirId;
      } else {
        const heir = await tx.communityMember.findFirst({
          where: { communityId, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
        heirUserId = heir?.userId;
      }

      if (heirUserId) {
        await tx.communityMember.update({
          where: { communityId_userId: { communityId, userId: heirUserId } },
          data: { role: 'OWNER' },
        });
        // Departing user's OWNER membership row is cascade-deleted with the user.
      } else {
        // Deleting the community cascade-removes its PostCommunity links, so
        // posts scoped only to it become public (and posts shared with other
        // communities keep those links).
        await tx.community.delete({ where: { id: communityId } });
      }
    }

    // 2. Owned organizations: transfer ownership or delete.
    const ownedOrgIds = (await tx.organizationMember.findMany({
      where: { userId, role: 'OWNER' },
      select: { organizationId: true },
    })).map((m) => m.organizationId);

    for (const organizationId of ownedOrgIds) {
      const pickedHeirId = organizationHeirs[organizationId];
      let heirUserId: string | undefined;

      if (pickedHeirId) {
        if (pickedHeirId === userId) {
          throw new AppError(400, 'Cannot designate yourself as heir');
        }
        const picked = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId: pickedHeirId } },
        });
        if (!picked) {
          throw new AppError(400, 'Designated heir is not a member of the organization');
        }
        heirUserId = pickedHeirId;
      } else {
        const heir = await tx.organizationMember.findFirst({
          where: { organizationId, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
        heirUserId = heir?.userId;
      }

      if (heirUserId) {
        await tx.organizationMember.update({
          where: { organizationId_userId: { organizationId, userId: heirUserId } },
          data: { role: 'OWNER' },
        });
      } else {
        await tx.post.updateMany({
          where: { organizationId },
          data: { organizationId: null },
        });
        await tx.organization.delete({ where: { id: organizationId } });
      }
    }

    // 3. Messages (FK Restrict on both sender and receiver).
    await tx.message.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    });

    // 4. Conversations where the user participates (FK Restrict).
    await tx.conversation.deleteMany({
      where: { OR: [{ participantAId: userId }, { participantBId: userId }] },
    });

    // 5. Posts authored by the user (FK Restrict on author). PostImages and
    //    PostFulfillments cascade from Post.
    await tx.post.deleteMany({ where: { authorId: userId } });

    // 6–9. Remaining Restrict-FK cleanup.
    await tx.report.deleteMany({ where: { reporterId: userId } });
    await tx.bugReport.deleteMany({ where: { reporterId: userId } });
    await tx.organizationInvite.deleteMany({ where: { invitedById: userId } });
    await tx.communityInvite.deleteMany({ where: { invitedById: userId } });

    // 10. Delete the user. Cascade/SetNull FKs handle the rest.
    await tx.user.delete({ where: { id: userId } });
  });

  if (avatarUrl) {
    await deleteObjectByUrl(avatarUrl).catch(() => {});
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Account deleted' });
}));

userRoutes.get('/:id/posts', requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  // Hide community posts the viewer isn't a member of (site ADMINs see everything)
  const where: Prisma.PostWhereInput = {
    authorId: req.params.id as string,
  };
  if (req.user!.role !== 'ADMIN') {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: req.user!.id },
      select: { communityId: true },
    });
    const myCommunityIds = memberships.map((m) => m.communityId);
    where.OR = myCommunityIds.length > 0
      ? [
          { communities: { none: {} } },
          { communities: { some: { communityId: { in: myCommunityIds } } } },
        ]
      : [{ communities: { none: {} } }];
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
    data: data.map(serializePost),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));
