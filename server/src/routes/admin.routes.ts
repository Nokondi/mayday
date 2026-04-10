import { Router } from 'express';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth);
adminRoutes.use(requireAdmin);

adminRoutes.get('/reports', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          reportedUser: { select: { id: true, name: true, email: true } },
          post: { select: { id: true, title: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
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

adminRoutes.put('/reports/:id', async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.body;
    if (!['REVIEWED', 'RESOLVED', 'DISMISSED'].includes(status)) {
      throw new AppError(400, 'Invalid status');
    }

    const report = await prisma.report.update({
      where: { id: req.params.id as string },
      data: { status, resolvedById: req.user!.id },
    });
    res.json(report);
  } catch (err) { next(err); }
});

adminRoutes.put('/users/:id/ban', async (req, res, next) => {
  try {
    const { banned } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { isBanned: Boolean(banned) },
      select: { id: true, name: true, email: true, isBanned: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

adminRoutes.delete('/posts/:id', async (_req, res, next) => {
  try {
    await prisma.post.delete({ where: { id: _req.params.id as string } });
    res.json({ message: 'Post deleted' });
  } catch (err) { next(err); }
});
