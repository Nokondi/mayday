import { useCallback, useEffect, useState } from 'react';
import type { WSMessage } from '@mayday/shared';
import { useDevice } from '../context/DeviceContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { getKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, fromBase64 } from '../crypto/conversation.js';

export interface ConversationKeyState {
  ck: Uint8Array;
  // Epoch the CK belongs to. After Phase 5 rotation, the same conversation
  // can have multiple epochs in the DB — we always pick the highest one so
  // *new* messages encrypted by this device use the latest CK.
  keyEpoch: number;
}

// Resolves the conversation key for a given conversation by fetching the
// caller's wraps from the server and unsealing the highest-epoch wrap
// addressed to this device. Returns null while loading or if no wrap exists
// for this device.
//
// Phase 3 wires this to the WebSocket so KEY_WRAPS_UPDATED triggers a refetch.
// Phase 5 picks the *highest* epoch (rather than the first wrap we see) so a
// post-rotation CK supersedes the old one transparently.
export function useConversationKey(conversationId: string | null): ConversationKeyState | null {
  const { device, serverId } = useDevice();
  const { addHandler, removeHandler } = useWebSocket();
  const [state, setState] = useState<ConversationKeyState | null>(null);
  const [tick, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    setState(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !device || !serverId) return;
    let cancelled = false;
    (async () => {
      try {
        const wraps = await getKeyWraps(conversationId);
        // Filter to wraps for *this* device, then pick the highest epoch.
        // A device may legitimately have wraps at multiple epochs after a
        // rotation — we want the freshest so new sends use the latest CK.
        const mine = wraps.filter((w) => w.deviceId === serverId);
        if (mine.length === 0) return;
        const latest = mine.reduce((a, b) => (a.keyEpoch >= b.keyEpoch ? a : b));
        const wrappedBytes = await fromBase64(latest.wrappedKey);
        const unwrapped = await unwrapConversationKey(
          wrappedBytes,
          device.encryption.publicKey,
          device.encryption.privateKey,
        );
        if (!cancelled && unwrapped) {
          setState({ ck: unwrapped, keyEpoch: latest.keyEpoch });
        }
      } catch {
        // No wraps yet, network error, etc. Stay null and wait for next tick.
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, device, serverId, tick]);

  useEffect(() => {
    if (!conversationId || !serverId) return;
    const handler = (msg: WSMessage) => {
      if (msg.type !== 'KEY_WRAPS_UPDATED') return;
      if (msg.payload.conversationId !== conversationId) return;
      if (!msg.payload.deviceIds.includes(serverId)) return;
      bumpTick();
    };
    addHandler(handler);
    return () => removeHandler(handler);
  }, [conversationId, serverId, addHandler, removeHandler, bumpTick]);

  return state;
}
