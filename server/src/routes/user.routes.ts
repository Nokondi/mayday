import { Router } from 'express';
import { updateProfileSchema, updateUserSettingsSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { uploadAvatar } from '../middleware/upload.middleware.js';
import { prisma } from '../config/database.js';
import { deleteObjectByUrl } from '../config/storage.js';
import { AppError } from '../middleware/error.middleware.js';
import { postInclude } from './post.routes.js';

export const userRoutes = Router();

const publicUserSelect = {
  id: true, name: true, bio: true, location: true, skills: true, avatarUrl: true, createdAt: true,
} as const;

// PUT /api/users/me/settings — update private settings for the current user
userRoutes.put('/me/settings', requireAuth, validate(updateUserSettingsSchema), async (req: AuthRequest, res, next) => {
  try {
    const { emailNotificationsEnabled } = req.body as { emailNotificationsEnabled?: boolean };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { emailNotificationsEnabled },
      select: { id: true, emailNotificationsEnabled: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

userRoutes.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: publicUserSelect,
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (err) { next(err); }
});

userRoutes.put('/:id', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id as string !== req.user!.id) {
      throw new AppError(403, 'Not authorized');
    }

    const { name, bio, location, latitude, longitude, skills } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { name, bio, location, latitude, longitude, skills },
      select: {
        id: true, email: true, name: true, bio: true,
        location: true, latitude: true, longitude: true,
        skills: true, avatarUrl: true, role: true, createdAt: true,
      },
    });
    res.json(user);
  } catch (err) { next(err); }
});

// Upload a new avatar for the authenticated user
userRoutes.post('/:id/avatar', requireAuth, uploadAvatar, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.user!.id) {
      throw new AppError(403, 'Not authorized');
    }
    const file = req.file as Express.MulterS3.File | undefined;
    if (!file) throw new AppError(400, 'No file uploaded');

    const existing = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: { avatarUrl: true },
    });

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { avatarUrl: file.location },
      select: publicUserSelect,
    });

    // Delete old avatar from Spaces (after successful update)
    if (existing?.avatarUrl) {
      await deleteObjectByUrl(existing.avatarUrl).catch(() => {});
    }

    res.json(user);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id — self-service account deletion.
// In a single transaction:
//   - owned communities/orgs with other members: ownership transfers to the
//     oldest remaining ADMIN (else oldest MEMBER) by joinedAt
//   - owned communities/orgs with no other members: deleted (posts are detached first)
//   - the user's posts, messages, conversations, reports, bug reports, and
//     sent invites are deleted to clear restrict-FK constraints
//   - the user is deleted; cascades clean up the rest (memberships, invites received, etc.)
userRoutes.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id !== req.user!.id) {
      throw new AppError(403, 'Not authorized');
    }
    const userId = req.user!.id;

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
        const heir = await tx.communityMember.findFirst({
          where: { communityId, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
        if (heir) {
          await tx.communityMember.update({
            where: { communityId_userId: { communityId, userId: heir.userId } },
            data: { role: 'OWNER' },
          });
          // Departing user's OWNER membership row is cascade-deleted with the user.
        } else {
          await tx.post.updateMany({
            where: { communityId },
            data: { communityId: null },
          });
          await tx.community.delete({ where: { id: communityId } });
        }
      }

      // 2. Owned organizations: transfer ownership or delete.
      const ownedOrgIds = (await tx.organizationMember.findMany({
        where: { userId, role: 'OWNER' },
        select: { organizationId: true },
      })).map((m) => m.organizationId);

      for (const organizationId of ownedOrgIds) {
        const heir = await tx.organizationMember.findFirst({
          where: { organizationId, userId: { not: userId } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
        if (heir) {
          await tx.organizationMember.update({
            where: { organizationId_userId: { organizationId, userId: heir.userId } },
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
  } catch (err) { next(err); }
});

userRoutes.get('/:id/posts', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    // Hide community posts the viewer isn't a member of (site ADMINs see everything)
    const where: { authorId: string; OR?: Array<{ communityId: null | { in: string[] } }> } = {
      authorId: req.params.id as string,
    };
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
  } catch (err) { next(err); }
});
