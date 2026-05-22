import type { PeerDevice, UploadKeyWrapsRequest } from '@mayday/shared';
import type { DeviceKeys } from './device.js';
import { getConversations } from '../api/messages.js';
import { getKeyWraps, uploadKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, wrapConversationKey, fromBase64, toBase64 } from './conversation.js';

// Runs when a DEVICE_ADDED event arrives. The same algorithm covers both
// own-handoff (newDevice.userId === me) and peer-rescue (newDevice.userId
// === a peer of one of my conversations): for every conversation where the
// new device's owner is a participant, see which epochs I hold wraps for,
// unwrap each one, re-wrap for the new device at the same epoch, and upload.
//
// Phase 5 covers ALL epochs we have access to (not just the latest) so the
// new device can decrypt the full conversation history after rotations,
// not just messages encrypted under the current CK.
//
// Idempotent on the server side: re-running this for the same (conv, device,
// epoch) tuple just overwrites the wrap (different ciphertext bytes since
// sealed-box uses an ephemeral keypair, but all decrypt to the same CK).
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

  const newDevicePubKey = await fromBase64(newDevice.encryptionPublicKey);

  await Promise.allSettled(targetConversations.map(async (conv) => {
    const wraps = await getKeyWraps(conv.id);
    const ourWraps = wraps.filter((w) => w.deviceId === ownDeviceServerId);
    if (ourWraps.length === 0) return; // No access to this conversation's CK.

    // For each epoch we hold a wrap at, produce a wrap for the new device —
    // unless one already exists at that epoch (race-safe). Without this loop,
    // post-rotation conversations would leave the rescued device able to
    // decrypt only the latest epoch and showing "Could not decrypt" for the
    // history.
    const alreadyWrappedEpochs = new Set(
      wraps.filter((w) => w.deviceId === newDevice.id).map((w) => w.keyEpoch),
    );
    const wrapsToUpload: UploadKeyWrapsRequest['wraps'] = [];
    for (const ours of ourWraps) {
      if (alreadyWrappedEpochs.has(ours.keyEpoch)) continue;
      const wrappedBytes = await fromBase64(ours.wrappedKey);
      const ck = await unwrapConversationKey(
        wrappedBytes,
        ownDevice.encryption.publicKey,
        ownDevice.encryption.privateKey,
      );
      if (!ck) continue;
      const wrappedForNewDevice = await wrapConversationKey(ck, newDevicePubKey);
      wrapsToUpload.push({
        deviceId: newDevice.id,
        wrappedKey: await toBase64(wrappedForNewDevice),
        keyEpoch: ours.keyEpoch,
      });
    }

    if (wrapsToUpload.length === 0) return;
    await uploadKeyWraps(conv.id, wrapsToUpload);
  }));
}
