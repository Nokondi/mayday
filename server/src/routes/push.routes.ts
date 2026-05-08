import { Router } from 'express';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const pushRoutes = Router();

// The VAPID public key is, by definition, public — the browser needs it to
// build a subscription. Returning null lets the client render a clear
// "push not configured" state instead of failing opaquely.
pushRoutes.get('/public-key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null });
});

pushRoutes.post(
  '/subscribe',
  requireAuth,
  rejectBanned,
  validate(pushSubscribeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { endpoint, keys, userAgent } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    };

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.user!.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
      },
      update: {
        userId: req.user!.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
      },
    });

    res.status(204).end();
  }),
);

pushRoutes.delete(
  '/unsubscribe',
  requireAuth,
  validate(pushUnsubscribeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { endpoint } = req.body as { endpoint: string };
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user!.id },
    });
    res.status(204).end();
  }),
);
