// The push enable/disable flows shared by the settings toggle and the
// boot-time bootstrapper. Extracted from PushNotificationsToggle so both can
// run the exact same handshake.

import type { IntlShape } from 'react-intl';
import { getPushPublicKey, subscribePush, unsubscribePush } from '../api/push.js';
import {
  isPushSupported,
  registerServiceWorker,
  getCurrentSubscription,
  subscribeToPush,
} from './push.js';

export type PushErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_NOT_GRANTED'
  | 'BLOCKED'
  | 'NO_CONFIG';

// Throw codes from the push flow so callers can render translated messages
// without `enablePush` itself needing intl access.
export class PushError extends Error {
  constructor(public code: PushErrorCode) {
    super(code);
  }
}

export async function enablePush(): Promise<void> {
  // Permission must be requested from a user gesture; callers trigger this
  // from a click/change handler, which qualifies.
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      throw new PushError(
        result === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_NOT_GRANTED',
      );
    }
  }
  if (Notification.permission !== 'granted') {
    throw new PushError('BLOCKED');
  }

  const reg = await registerServiceWorker();
  const publicKey = await getPushPublicKey();
  if (!publicKey) {
    throw new PushError('NO_CONFIG');
  }

  const existing = await getCurrentSubscription(reg);
  const sub = existing ?? (await subscribeToPush(reg, publicKey));
  await subscribePush(sub);
}

export async function disablePush(): Promise<void> {
  // Unsubscribe server-side first so a half-failed turn-off doesn't leave the
  // browser quiet while the server still thinks we want pushes.
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await unsubscribePush(sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Silently make sure a browser subscription exists and is registered
 * server-side. Never prompts: a no-op unless notification permission is
 * already granted. Covers fresh installs / new browser profiles where
 * permission carried over but no PushSubscription row exists, and repairs
 * subscriptions the push service dropped. Re-POSTing an existing subscription
 * is an idempotent upsert that also re-links it to the current account.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  const reg = await registerServiceWorker();
  const existing = await getCurrentSubscription(reg);
  if (existing) {
    await subscribePush(existing);
    return;
  }

  const publicKey = await getPushPublicKey();
  if (!publicKey) return;
  const sub = await subscribeToPush(reg, publicKey);
  await subscribePush(sub);
}

export function translatePushError(intl: IntlShape, code: PushErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return intl.formatMessage({
        id: 'common.pushNotificationsToggle.permissionDeniedError',
        defaultMessage:
          'You denied notification permission. Re-enable it in your browser site settings.',
      });
    case 'PERMISSION_NOT_GRANTED':
      return intl.formatMessage({
        id: 'common.pushNotificationsToggle.permissionNotGrantedError',
        defaultMessage: 'Notification permission was not granted.',
      });
    case 'BLOCKED':
      return intl.formatMessage({
        id: 'common.pushNotificationsToggle.blockedError',
        defaultMessage: 'Notifications are blocked in your browser.',
      });
    case 'NO_CONFIG':
      return intl.formatMessage({
        id: 'common.pushNotificationsToggle.noConfigError',
        defaultMessage: 'Push notifications are not configured on the server.',
      });
  }
}
