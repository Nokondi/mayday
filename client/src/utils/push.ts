// Browser-side helpers for the Web Push subscription handshake.
// All of these are pure (no React) so they can be called from any layer.

const SW_PATH = '/sw.js';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_PATH);
  // Wait until there's an active worker — `subscribe()` requires one.
  if (reg.active) return reg;
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getCurrentSubscription(
  reg: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
  });
}

// Standard helper from the MDN Push API docs — converts the base64url-encoded
// VAPID public key into the ArrayBuffer `pushManager.subscribe` requires.
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    view[i] = raw.charCodeAt(i);
  }
  return buffer;
}
