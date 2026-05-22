import { useCallback, useEffect, useState } from 'react';
import type { WSMessage } from '@mayday/shared';
import { useDevice } from '../context/DeviceContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { getKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, fromBase64 } from '../crypto/conversation.js';

// Resolves the conversation key for a given conversation by fetching the
// caller's wraps from the server and unsealing the one addressed to this
// device. Returns null while loading or if no wrap exists for this device
// (e.g. conversation hasn't been encrypted yet, or this is a brand-new
// device waiting for own-handoff from a sister device).
//
// Phase 3 wires this to the WebSocket: a KEY_WRAPS_UPDATED event that
// mentions our deviceId triggers a refetch, so a fresh device picks up its
// handed-off wrap immediately rather than on the next refresh.
export function useConversationKey(conversationId: string | null): Uint8Array | null {
  const { device, serverId } = useDevice();
  const { addHandler, removeHandler } = useWebSocket();
  const [ck, setCk] = useState<Uint8Array | null>(null);
  const [tick, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick((n) => n + 1), []);

  // Reset CK whenever the active conversation changes so we never display a
  // CK that belonged to a different conversation.
  useEffect(() => {
    setCk(null);
  }, [conversationId]);

  // Resolve wraps → CK. Re-runs on conversation/device change AND on tick
  // bumps (which we trigger from the WS handler below).
  useEffect(() => {
    if (!conversationId || !device || !serverId) return;
    let cancelled = false;
    (async () => {
      try {
        const wraps = await getKeyWraps(conversationId);
        const ours = wraps.find((w) => w.deviceId === serverId);
        if (!ours) return;
        const wrappedBytes = await fromBase64(ours.wrappedKey);
        const unwrapped = await unwrapConversationKey(
          wrappedBytes,
          device.encryption.publicKey,
          device.encryption.privateKey,
        );
        if (!cancelled && unwrapped) setCk(unwrapped);
      } catch {
        // No wraps yet, network error, etc. Stay null and wait for next tick.
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId, device, serverId, tick]);

  // WS-triggered refetch: when the server tells us that wraps have changed
  // for our device on this conversation, bump the tick to re-resolve.
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

  return ck;
}
