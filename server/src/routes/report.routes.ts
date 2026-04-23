import { Router } from 'express';
import { createReportSchema, reportUserSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';

export const reportRoutes = Router();

reportRoutes.use(requireAuth);
reportRoutes.use(rejectBanned);

reportRoutes.post('/', validate(createReportSchema), async (req: AuthRequest, res, next) => {
  try {
    const report = await prisma.report.create({
      data: {
        ...req.body,
        reporterId: req.user!.id,
      },
    });
    res.status(201).json(report);
  } catch (err) { next(err); }
});

// POST /api/reports/user — report a user by email (used from the Support page).
// Resolves email → userId server-side so callers don't need the UUID.
reportRoutes.post('/user', validate(reportUserSchema), async (req: AuthRequest, res, next) => {
  try {
    const { email, reason, details } = req.body;
    const target = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!target) throw new AppError(404, 'No user found with that email');
    if (target.id === req.user!.id) throw new AppError(400, 'You cannot report yourself');

    const report = await prisma.report.create({
      data: {
        reason,
        details,
        reportedUserId: target.id,
        reporterId: req.user!.id,
      },
    });
    res.status(201).json(report);
  } catch (err) { next(err); }
});
