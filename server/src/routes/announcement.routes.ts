import { Router } from 'express';
import { createAnnouncementSchema, updateAnnouncementSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendAnnouncementEmail } from '../services/mail.service.js';

export const announcementRoutes = Router();

const ANNOUNCEMENT_EMAIL_CONCURRENCY = 5;

async function broadcastAnnouncement(message: string): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      emailNotificationsEnabled: true,
      emailVerified: true,
      isBanned: false,
    },
    select: { email: true, name: true },
  });

  for (let i = 0; i < recipients.length; i += ANNOUNCEMENT_EMAIL_CONCURRENCY) {
    const batch = recipients.slice(i, i + ANNOUNCEMENT_EMAIL_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((r) => sendAnnouncementEmail(r.email, r.name, message)),
    );
    for (const [idx, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error(
          `[announcement] failed to email ${batch[idx]?.email}:`,
          result.reason,
        );
      }
    }
  }
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
