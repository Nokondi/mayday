import { useEffect, useState } from 'react';
import { useDevice } from '../context/DeviceContext.js';
import { getKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, fromBase64 } from '../crypto/conversation.js';

// Resolves the conversation key for a given conversation by fetching the
// caller's wraps from the server and unsealing the one addressed to this
// device. Returns null while loading or if no wrap exists for this device
// (e.g. conversation hasn't been encrypted yet, or the wrap predates this
// device — Phase 3 own-handoff will populate that later).
//
// Phase 2 keeps the CK in component-local state. That means a re-mount
// re-fetches and re-unwraps, but the bytes never persist outside memory —
// matches the threat model (CK on a stolen disk should be unrecoverable).
export function useConversationKey(conversationId: string | null): Uint8Array | null {
  const { device, serverId } = useDevice();
  const [ck, setCk] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!conversationId || !device || !serverId) {
      setCk(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const wraps = await getKeyWraps(conversationId);
        const ours = wraps.find((w) => w.deviceId === serverId);
        if (!ours) return; // no wrap for this device yet
        const wrappedBytes = await fromBase64(ours.wrappedKey);
        const unwrapped = await unwrapConversationKey(
          wrappedBytes,
          device.encryption.publicKey,
          device.encryption.privateKey,
        );
        if (!cancelled && unwrapped) setCk(unwrapped);
      } catch {
        // No wraps yet (server returns []), or fetch failed. Either way the
        // caller will fall back to plaintext or attempt to establish a key.
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, device, serverId]);

  return ck;
}
