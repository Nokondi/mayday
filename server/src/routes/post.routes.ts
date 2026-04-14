import { Router } from 'express';
import { createPostSchema, updatePostSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { uploadPostImages } from '../middleware/upload.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import type { Prisma } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const postInclude = {
  author: {
    select: { id: true, name: true, bio: true, location: true, skills: true, createdAt: true },
  },
  organization: {
    select: { id: true, name: true, avatarUrl: true },
  },
  community: {
    select: { id: true, name: true },
  },
  images: {
    select: { id: true, url: true, order: true },
    orderBy: { order: 'asc' as const },
  },
};

/** Returns the IDs of communities the user belongs to. */
async function getUserCommunityIds(userId: string): Promise<string[]> {
  const memberships = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true },
  });
  return memberships.map((m) => m.communityId);
}

/**
 * A user can modify a post if they are:
 *   - the original author
 *   - an ADMIN (site-wide)
 *   - an OWNER or ADMIN of the post's organization (for org posts)
 */
async function canModifyPost(
  post: { authorId: string; organizationId: string | null },
  user: { id: string; role: string },
): Promise<boolean> {
  if (post.authorId === user.id) return true;
  if (user.role === 'ADMIN') return true;
  if (post.organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: post.organizationId, userId: user.id },
      },
    });
    if (membership && (membership.role === 'OWNER' || membership.role === 'ADMIN')) {
      return true;
    }
  }
  return false;
}

export const postRoutes = Router();

postRoutes.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      type, category, status, urgency, q,
      neLat, neLng, swLat, swLng,
      page = '1', limit = '20', sort = 'recent',
      communityId,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

    const where: Prisma.PostWhereInput = {};
    if (type) where.type = type as 'REQUEST' | 'OFFER';
    if (category) where.category = category as string;
    if (status) where.status = status as 'OPEN' | 'FULFILLED' | 'CLOSED';
    if (urgency) where.urgency = urgency as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (neLat && neLng && swLat && swLng) {
      where.latitude = {
        gte: parseFloat(swLat as string),
        lte: parseFloat(neLat as string),
      };
      where.longitude = {
        gte: parseFloat(swLng as string),
        lte: parseFloat(neLng as string),
      };
    }

    // Text search (AND'd with other filters)
    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: [
          { title: { contains: q as string, mode: 'insensitive' } },
          { description: { contains: q as string, mode: 'insensitive' } },
        ] },
      ];
    }

    // Community visibility: if filtering by a specific community, only show that
    // community's posts. Otherwise show public posts + posts from user's communities.
    if (communityId) {
      where.communityId = communityId as string;
    } else {
      const myCommunityIds = await getUserCommunityIds(req.user!.id);
      const visibilityFilter: Prisma.PostWhereInput = myCommunityIds.length > 0
        ? { OR: [{ communityId: null }, { communityId: { in: myCommunityIds } }] }
        : { communityId: null };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), visibilityFilter];
    }

    const orderBy: Prisma.PostOrderByWithRelationInput =
      sort === 'urgency'
        ? { urgency: 'desc' }
        : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: postInclude,
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) { next(err); }
});

postRoutes.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: postInclude,
    });
    if (!post) throw new AppError(404, 'Post not found');

    // Check community visibility
    if (post.communityId) {
      const membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: post.communityId, userId: req.user!.id } },
      });
      if (!membership && req.user!.role !== 'ADMIN') {
        throw new AppError(403, 'This post is only visible to community members');
      }
    }

    res.json(post);
  } catch (err) { next(err); }
});

postRoutes.get('/:id/matches', requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!post) throw new AppError(404, 'Post not found');

    const matchType = post.type === 'REQUEST' ? 'OFFER' : 'REQUEST';
    const where: Prisma.PostWhereInput = {
      type: matchType,
      category: post.category,
      status: 'OPEN',
      id: { not: post.id },
    };

    if (post.latitude && post.longitude) {
      const radiusInDegrees = 0.45; // ~50km
      where.latitude = { gte: post.latitude - radiusInDegrees, lte: post.latitude + radiusInDegrees };
      where.longitude = { gte: post.longitude - radiusInDegrees, lte: post.longitude + radiusInDegrees };
    }

    const matches = await prisma.post.findMany({
      where,
      include: postInclude,
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    res.json(matches);
  } catch (err) { next(err); }
});

// Create post with optional image uploads (multipart/form-data)
postRoutes.post('/', requireAuth, uploadPostImages, async (req: AuthRequest, res, next) => {
  try {
    // When using multipart, form fields come as strings — parse them
    const body = { ...req.body };

    // Parse numeric fields that arrive as strings from FormData
    if (body.latitude) body.latitude = parseFloat(body.latitude);
    if (body.longitude) body.longitude = parseFloat(body.longitude);

    // Validate the parsed body
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join(', ');
      throw new AppError(400, message);
    }

    // If posting on behalf of an organization, verify membership
    if (parsed.data.organizationId) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: parsed.data.organizationId,
            userId: req.user!.id,
          },
        },
      });
      if (!membership) {
        throw new AppError(403, 'You are not a member of this organization');
      }
    }

    // If scoping to a community, verify membership
    if (parsed.data.communityId) {
      const membership = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: parsed.data.communityId,
            userId: req.user!.id,
          },
        },
      });
      if (!membership) {
        throw new AppError(403, 'You are not a member of this community');
      }
    }

    const post = await prisma.post.create({
      data: { ...parsed.data, authorId: req.user!.id },
    });

    // Create PostImage records for uploaded files
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > 0) {
      await prisma.postImage.createMany({
        data: files.map((file, index) => ({
          postId: post.id,
          url: `/uploads/posts/${file.filename}`,
          order: index,
        })),
      });
    }

    // Re-fetch with includes
    const fullPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: postInclude,
    });

    res.status(201).json(fullPost);
  } catch (err) { next(err); }
});

postRoutes.put('/:id', requireAuth, validate(updatePostSchema), async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.post.findUnique({ where: { id: req.params.id as string } });
    if (!existing) throw new AppError(404, 'Post not found');
    if (!(await canModifyPost(existing, req.user!))) {
      throw new AppError(403, 'Not authorized');
    }

    // Don't let editors change the org/community link via update
    const { organizationId: _ignoreOrg, communityId: _ignoreCommunity, ...updateData } = req.body;

    const post = await prisma.post.update({
      where: { id: req.params.id as string },
      data: updateData,
      include: postInclude,
    });
    res.json(post);
  } catch (err) { next(err); }
});

postRoutes.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.post.findUnique({
      where: { id: req.params.id as string },
      include: { images: true },
    });
    if (!existing) throw new AppError(404, 'Post not found');
    if (!(await canModifyPost(existing, req.user!))) {
      throw new AppError(403, 'Not authorized');
    }

    // Delete image files from disk
    for (const image of existing.images) {
      const filePath = path.join(__dirname, '../..', image.url);
      await fs.unlink(filePath).catch(() => {});
    }

    await prisma.post.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Post deleted' });
  } catch (err) { next(err); }
});

// Delete a single image from a post
postRoutes.delete('/:postId/images/:imageId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const image = await prisma.postImage.findUnique({
      where: { id: req.params.imageId as string },
      include: { post: true },
    });
    if (!image) throw new AppError(404, 'Image not found');
    if (!(await canModifyPost(image.post, req.user!))) {
      throw new AppError(403, 'Not authorized');
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../..', image.url);
    await fs.unlink(filePath).catch(() => {});

    await prisma.postImage.delete({ where: { id: image.id } });
    res.json({ message: 'Image deleted' });
  } catch (err) { next(err); }
});
