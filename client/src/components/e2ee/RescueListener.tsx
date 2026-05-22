import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useDevice } from '../../context/DeviceContext.js';
import { useWebSocket } from '../../context/WebSocketContext.js';
import { rescueConversationKeysForDevice } from '../../crypto/rescue.js';
import type { WSMessage } from '@mayday/shared';

// Global listener for DEVICE_ADDED events. Mounted once near the App root so
// it's active regardless of which page the user is on. Triggers conversation
// key handoff to the new device (own-handoff or peer-rescue depending on
// whether the new device belongs to the current user or a peer).
//
// Renders nothing — pure side-effect component.
export function RescueListener(): null {
  const { user } = useAuth();
  const { device, serverId } = useDevice();
  const { addHandler, removeHandler } = useWebSocket();

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

  return null;
}
