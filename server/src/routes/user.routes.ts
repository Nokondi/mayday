import { Router } from 'express';
import { updateProfileSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { uploadAvatar } from '../middleware/upload.middleware.js';
import { prisma } from '../config/database.js';
import { deleteObjectByUrl } from '../config/storage.js';
import { AppError } from '../middleware/error.middleware.js';

export const userRoutes = Router();

const publicUserSelect = {
  id: true, name: true, bio: true, location: true, skills: true, avatarUrl: true, createdAt: true,
} as const;

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

userRoutes.get('/:id/posts', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: req.params.id as string },
        include: {
          author: { select: publicUserSelect },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where: { authorId: req.params.id as string } }),
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
