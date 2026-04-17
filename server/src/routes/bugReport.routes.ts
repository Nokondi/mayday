import { Router } from 'express';
import { createBugReportSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';

export const bugReportRoutes = Router();

bugReportRoutes.use(requireAuth);
bugReportRoutes.use(rejectBanned);

bugReportRoutes.post('/', validate(createBugReportSchema), async (req: AuthRequest, res, next) => {
  try {
    const bugReport = await prisma.bugReport.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        reporterId: req.user!.id,
      },
    });
    res.status(201).json(bugReport);
  } catch (err) { next(err); }
});
