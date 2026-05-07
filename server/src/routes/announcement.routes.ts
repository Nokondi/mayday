import { Router } from 'express';
import { createAnnouncementSchema, updateAnnouncementSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyMany } from '../services/notification.service.js';

export const announcementRoutes = Router();

async function broadcastAnnouncement(message: string): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      emailVerified: true,
      isBanned: false,
      OR: [
        { emailNotificationsEnabled: true },
        { pushNotificationsEnabled: true },
      ],
    },
    select: { id: true },
  });

  await notifyMany(
    recipients.map((r) => r.id),
    { type: 'ANNOUNCEMENT', message },
  );
}

announcementRoutes.get('/active', asyncHandler(async (_req, res) => {
  const announcement = await prisma.announcement.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(announcement);
}));

announcementRoutes.get('/', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(announcements);
}));

announcementRoutes.post(
  '/',
  requireAuth,
  requireAdmin,
  validate(createAnnouncementSchema),
  asyncHandler(async (req, res) => {
    const announcement = await prisma.$transaction(async (tx) => {
      await tx.announcement.updateMany({
        where: { active: true },
        data: { active: false },
      });
      return tx.announcement.create({
        data: { message: req.body.message },
      });
    });

    broadcastAnnouncement(announcement.message).catch((err) => {
      console.error('[announcement] broadcast failed:', err);
    });

    res.status(201).json(announcement);
  }),
);

announcementRoutes.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(updateAnnouncementSchema),
  asyncHandler(async (req, res) => {
    const announcement = await prisma.announcement.update({
      where: { id: req.params.id as string },
      data: req.body,
    });
    res.json(announcement);
  }),
);

announcementRoutes.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id as string } });
  res.json({ message: 'Announcement deleted' });
}));
