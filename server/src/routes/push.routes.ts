import { Router } from 'express';
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushResubscribeSchema,
  type PushResubscribeRequest,
} from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, rejectBanned, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/error.middleware.js';
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

// POST /api/push/resubscribe — rotate a subscription in place when the push
// service invalidates it (the service worker's pushsubscriptionchange event).
// Deliberately unauthenticated by JWT: the service worker has no access token.
// Possession of the old endpoint is the credential — push endpoints are long,
// unguessable capability URLs known only to the browser that owns them, and
// the rotated row keeps its existing userId, so a caller can only redirect
// pushes for a subscription it already held.
pushRoutes.post(
  '/resubscribe',
  validate(pushResubscribeSchema),
  asyncHandler(async (req, res) => {
    const { oldEndpoint, subscription } = req.body as PushResubscribeRequest;

    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: oldEndpoint },
      select: { userId: true },
    });
    if (!existing) throw new AppError(404, 'Unknown subscription');

    // Delete-then-upsert (rather than update) so a retried rotation, where the
    // new endpoint row already exists, stays idempotent instead of tripping
    // the unique constraint.
    await prisma.$transaction([
      prisma.pushSubscription.deleteMany({ where: { endpoint: oldEndpoint } }),
      prisma.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        create: {
          userId: existing.userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: subscription.userAgent ?? null,
        },
        update: {
          userId: existing.userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      }),
    ]);

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
