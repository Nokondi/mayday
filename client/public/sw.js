// Mayday push notification service worker. Plain JS — Vite copies /public
// verbatim, so this file is served as-is from the same origin as the app and
// scoped to the whole site. Keep dependency-free.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url;
  event.waitUntil(focusOrOpen(targetUrl || '/'));
});

// Push services rotate or expire subscriptions (browser updates, key
// rotation). Without this handler the old endpoint dies silently and the
// device stops receiving pushes until the user re-toggles them. Resubscribe
// with the same VAPID key and tell the server to swap the endpoint in place.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(handleSubscriptionChange(event));
});

async function handleSubscriptionChange(event) {
  const oldSub = event.oldSubscription || null;
  try {
    let key =
      oldSub && oldSub.options && oldSub.options.applicationServerKey;
    if (!key) {
      const res = await fetch('/api/push/public-key');
      const data = await res.json();
      if (!data.publicKey) return;
      key = urlBase64ToBuffer(data.publicKey);
    }

    const newSub =
      event.newSubscription ||
      (await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));

    // Without the old endpoint there's nothing to rotate server-side; the
    // app re-registers the subscription on its next launch (PushBootstrap).
    if (!oldSub || !oldSub.endpoint) return;

    await fetch('/api/push/resubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldEndpoint: oldSub.endpoint,
        subscription: newSub.toJSON(),
      }),
    });
  } catch (_err) {
    // Best effort — the next app launch repairs the subscription.
  }
}

// Same helper as client/src/utils/push.ts — the SW bundle is standalone, so
// it keeps its own copy.
function urlBase64ToBuffer(base64String) {
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

async function handlePush(event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (_err) {
    payload = { title: 'Mayday', body: event.data.text(), url: '/' };
  }

  // Suppress NEW_MESSAGE notifications when a Mayday tab is already focused
  // on /messages — the WebSocket renders the new message in-app.
  if (payload.tag && payload.tag.startsWith('msg:')) {
    const focusedOnMessages = await isFocusedOn('/messages');
    if (focusedOnMessages) return;
  }

  await self.registration.showNotification(payload.title || 'Mayday', {
    body: payload.body || '',
    tag: payload.tag,
    icon: payload.icon || '/mayday-logo.png',
    badge: payload.icon || '/mayday-logo.png',
    data: { url: payload.url || '/' },
  });
}

async function isFocusedOn(pathname) {
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  return allClients.some((c) => {
    if (!c.focused) return false;
    try {
      return new URL(c.url).pathname.startsWith(pathname);
    } catch (_err) {
      return false;
    }
  });
}

async function focusOrOpen(url) {
  const allClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // Prefer an already-open Mayday tab — focus it and navigate to the deep link.
  for (const client of allClients) {
    try {
      const sameOrigin = new URL(client.url).origin === self.location.origin;
      if (!sameOrigin) continue;
      await client.focus();
      if ('navigate' in client) {
        await client.navigate(url);
      }
      return;
    } catch (_err) {
      // fall through to the next client
    }
  }

  if (self.clients.openWindow) {
    await self.clients.openWindow(url);
  }
}
