import webpush from 'web-push';
import type { PushPayload } from '@mayday/shared';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  const contact = env.VAPID_CONTACT_EMAIL || env.SMTP_FROM || env.SMTP_USER;
  if (!contact) return false;
  const subject = contact.startsWith('mailto:') ? contact : `mailto:${contact}`;
  webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return configure();
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubscription(
  sub: SubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; gone: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number } | null)?.statusCode;
    const gone = status === 404 || status === 410;
    if (!gone) {
      console.error(`[push] send failed (status=${status ?? 'unknown'})`, err);
    }
    return { ok: false, gone };
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!configure()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const results = await Promise.all(
    subs.map(async (sub) => ({ sub, result: await sendToSubscription(sub, payload) })),
  );

  const goneIds: string[] = [];
  const okIds: string[] = [];
  for (const { sub, result } of results) {
    if (result.ok) okIds.push(sub.id);
    else if (result.gone) goneIds.push(sub.id);
  }

  if (goneIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: goneIds } } });
  }
  if (okIds.length > 0) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: okIds } },
      data: { lastSuccessAt: new Date() },
    });
  }
}
