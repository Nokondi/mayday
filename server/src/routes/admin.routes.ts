import { Router } from 'express';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth);
adminRoutes.use(requireAdmin);

adminRoutes.get('/reports', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const VALID_REPORT_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'];
  const where = (status && VALID_REPORT_STATUSES.includes(status))
    ? { status: status as 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED' }
    : {};

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
}));

adminRoutes.put('/reports/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (!['REVIEWED', 'RESOLVED', 'DISMISSED'].includes(status)) {
    throw new AppError(400, 'Invalid status');
  }

  const report = await prisma.report.update({
    where: { id: req.params.id as string },
    data: { status, resolvedById: req.user!.id },
  });
  res.json(report);
}));

adminRoutes.get('/users', asyncHandler(async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const role = req.query.role as string | undefined;
  const bannedParam = req.query.banned as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role === 'USER' || role === 'ADMIN') {
    where.role = role;
  }
  if (bannedParam === 'true') where.isBanned = true;
  else if (bannedParam === 'false') where.isBanned = false;

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

adminRoutes.put('/users/:id/ban', asyncHandler(async (req, res) => {
  const { banned } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { isBanned: Boolean(banned) },
    select: { id: true, name: true, email: true, isBanned: true },
  });
  res.json(user);
}));

adminRoutes.delete('/posts/:id', asyncHandler(async (_req, res) => {
  await prisma.post.delete({ where: { id: _req.params.id as string } });
  res.json({ message: 'Post deleted' });
}));

adminRoutes.get('/bug-reports', asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const VALID_BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const where = (status && VALID_BUG_STATUSES.includes(status))
    ? { status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }
    : {};

  const [data, total] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bugReport.count({ where }),
  ]);

  res.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

adminRoutes.put('/bug-reports/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    throw new AppError(400, 'Invalid status');
  }

  const bugReport = await prisma.bugReport.update({
    where: { id: req.params.id as string },
    data: { status },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(bugReport);
}));
