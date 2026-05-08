import { api } from './client.js';

export async function getPushPublicKey(): Promise<string | null> {
  const res = await api.get<{ publicKey: string | null }>('/push/public-key');
  return res.data.publicKey;
}

export async function subscribePush(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription — missing endpoint or keys');
  }
  await api.post('/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent,
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.delete('/push/unsubscribe', { data: { endpoint } });
}
