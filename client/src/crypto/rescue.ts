import type { PeerDevice } from '@mayday/shared';
import type { DeviceKeys } from './device.js';
import { getConversations } from '../api/messages.js';
import { getKeyWraps, uploadKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, wrapConversationKey, fromBase64, toBase64 } from './conversation.js';

// Runs when a DEVICE_ADDED event arrives. The same algorithm covers both
// own-handoff (newDevice.userId === me) and peer-rescue (newDevice.userId
// === a peer of one of my conversations): for every conversation where the
// new device's owner is a participant, see if I hold a wrap I can unwrap,
// and if so, wrap the recovered CK for the new device and upload it.
//
// Idempotent on the server side: re-running this for the same (conv, device)
// pair just overwrites the wrap (different ciphertext bytes since sealed-box
// uses an ephemeral keypair, but they all decrypt to the same CK).
export interface RescueParams {
  currentUserId: string;
  ownDevice: DeviceKeys;
  ownDeviceServerId: string;
  newDevice: PeerDevice;
}

export async function rescueConversationKeysForDevice(params: RescueParams): Promise<void> {
  const { currentUserId, ownDevice, ownDeviceServerId, newDevice } = params;

  // Never try to rescue for our own device: we'd be wrapping with a public
  // key whose private key we already have, which is pointless and (worse)
  // would mask a bug elsewhere by silently succeeding.
  if (newDevice.id === ownDeviceServerId) return;

  const conversations = await getConversations();

  // Filter to conversations where the new device's owner is a participant.
  // For own-handoff this is all of our conversations; for peer-rescue it's
  // the subset where the peer is the other participant.
  const targetConversations = conversations.filter((c) => {
    if (newDevice.userId === currentUserId) return true;
    return c.otherParticipant.id === newDevice.userId;
  });

  // Decode the new device's public key once.
  const newDevicePubKey = await fromBase64(newDevice.encryptionPublicKey);

  // Process conversations in parallel — they're independent. If any one
  // fails (network blip, conversation already migrated, etc.) we let the
  // others continue and swallow the per-conversation error.
  await Promise.allSettled(targetConversations.map(async (conv) => {
    const wraps = await getKeyWraps(conv.id);
    const ourWrap = wraps.find((w) => w.deviceId === ownDeviceServerId);
    if (!ourWrap) return; // We don't have access to this conversation's CK.

    // Skip if the new device already has a wrap at the same epoch — saves a
    // round trip and avoids overwriting a wrap that another own device may
    // have already uploaded.
    if (wraps.some((w) => w.deviceId === newDevice.id && w.keyEpoch === ourWrap.keyEpoch)) {
      return;
    }

    const wrappedBytes = await fromBase64(ourWrap.wrappedKey);
    const ck = await unwrapConversationKey(
      wrappedBytes,
      ownDevice.encryption.publicKey,
      ownDevice.encryption.privateKey,
    );
    if (!ck) return; // Our own wrap is unreadable — shouldn't happen, but skip.

    const wrappedForNewDevice = await wrapConversationKey(ck, newDevicePubKey);
    await uploadKeyWraps(conv.id, [{
      deviceId: newDevice.id,
      wrappedKey: await toBase64(wrappedForNewDevice),
      keyEpoch: ourWrap.keyEpoch,
    }]);
  }));
}
