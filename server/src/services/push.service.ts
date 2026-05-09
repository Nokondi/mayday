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

// Subset of web-push's RequestOptions we expose. urgency tells the push
// service whether to wake the device now ('high') or batch for power
// efficiency ('normal', the default); TTL caps how long it'll hold the
// message if the device is offline.
export interface PushSendOptions {
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  TTL?: number;
}

async function sendToSubscription(
  sub: SubscriptionRow,
  payload: PushPayload,
  options?: PushSendOptions,
): Promise<{ ok: true } | { ok: false; gone: boolean }> {
  const target = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };
  const body = JSON.stringify(payload);
  try {
    if (options) {
      await webpush.sendNotification(target, body, options);
    } else {
      await webpush.sendNotification(target, body);
    }
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
  options?: PushSendOptions,
): Promise<void> {
  if (!configure()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const results = await Promise.all(
    subs.map(async (sub) => ({
      sub,
      result: await sendToSubscription(sub, payload, options),
    })),
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
