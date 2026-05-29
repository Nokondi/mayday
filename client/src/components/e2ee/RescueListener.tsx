import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useDevice } from '../../context/DeviceContext.js';
import { useWebSocket } from '../../context/WebSocketContext.js';
import { rescueConversationKeysForDevice, reconcileConversationKeys } from '../../crypto/rescue.js';
import type { WSMessage } from '@mayday/shared';

// Global handler for conversation-key handoff. Mounted once near the App root
// so it's active regardless of which page the user is on. Two paths:
//
//   1. Live: a DEVICE_ADDED event triggers an immediate rescue for the new
//      device (own-handoff or peer-rescue depending on whose device it is).
//   2. Recovery: on every WebSocket (re)connect, a reconciliation sweep
//      re-wraps the CK for any participant device that's missing it. This
//      covers the case where we weren't connected when a device registered,
//      so its one-shot DEVICE_ADDED event was dropped and never retried.
//
// Renders nothing — pure side-effect component.
export function RescueListener(): null {
  const { user } = useAuth();
  const { device, serverId } = useDevice();
  const { isConnected, addHandler, removeHandler } = useWebSocket();

  useEffect(() => {
    if (!user || !device || !serverId) return;
    const handler = (msg: WSMessage) => {
      if (msg.type !== 'DEVICE_ADDED') return;
      // Fire and forget; rescue is idempotent on the server. We don't
      // surface errors here because a failed rescue is recoverable (the
      // new device will poll/refetch or another own device will retry).
      void rescueConversationKeysForDevice({
        currentUserId: user.id,
        ownDevice: device,
        ownDeviceServerId: serverId,
        newDevice: msg.payload.device,
      });
    };
    addHandler(handler);
    return () => removeHandler(handler);
  }, [user, device, serverId, addHandler, removeHandler]);

  // Recovery sweep on (re)connect. Re-runs each time isConnected flips true
  // (initial connect and every reconnect after a drop), so a device that
  // registered while we were offline still gets its wrap once we're back.
  useEffect(() => {
    if (!isConnected || !user || !device || !serverId) return;
    void reconcileConversationKeys({ ownDevice: device, ownDeviceServerId: serverId });
  }, [isConnected, user, device, serverId]);

  return null;
}
