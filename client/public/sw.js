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
