import { Router } from 'express';
import { createReportSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';

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
