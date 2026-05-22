import type { PeerDevice, Device } from '@mayday/shared';
import { getUserDevices, getMyDevices } from '../api/devices.js';
import { uploadKeyWraps } from '../api/keyWraps.js';
import { generateConversationKey, wrapConversationKey, fromBase64, toBase64 } from './conversation.js';

// Generates a fresh conversation key, wraps it for every active device of
// both participants, and uploads the wraps to the server in one call. Returns
// the plaintext CK (so the caller can immediately encrypt the first message)
// or null when there are no peer devices to wrap to — in that case the caller
// should fall back to plaintext.
//
// Wraps the freshly-generated CK for every active device of both the peer
// and the current user — Phase 3 lifts the Phase 2 single-own-device
// restriction so a user with multiple devices/tabs can read the conversation
// from any of them. The DEVICE_ADDED listener handles future additions; this
// only covers what exists at establish time.
//
// `ownDeviceServerId` is still required (we need to know which device the
// caller is) but is now used only for the corresponding test assertion that
// the current device gets a wrap — it's no longer used to filter targets.
export async function establishConversationKey(
  conversationId: string,
  peerUserId: string,
  ownDeviceServerId: string,
  keyEpoch: number = 1,
): Promise<Uint8Array | null> {
  // Reference kept so the parameter is part of the public signature even
  // though Phase 3 no longer uses it for filtering. Keep until Phase 5 cleans up.
  void ownDeviceServerId;

  const [peerDevices, ownDevices] = await Promise.all([
    getUserDevices(peerUserId),
    getMyDevices(),
  ]);

  const activePeers: PeerDevice[] = peerDevices;
  const activeOwn: Device[] = ownDevices.filter((d) => !d.revokedAt);

  if (activePeers.length === 0) {
    // Peer hasn't enrolled a device yet. Caller falls back to plaintext.
    return null;
  }

  const ck = await generateConversationKey();

  // Wrap once per recipient device. The peer's encryptionPublicKey is base64
  // on the wire — decode then seal. We wrap for every active own device so
  // any of the user's browsers can decrypt on first load.
  const wrapTargets: { deviceId: string; publicKeyB64: string }[] = [
    ...activePeers.map((d) => ({ deviceId: d.id, publicKeyB64: d.encryptionPublicKey })),
    ...activeOwn.map((d) => ({ deviceId: d.id, publicKeyB64: d.encryptionPublicKey })),
  ];

  const wraps = await Promise.all(
    wrapTargets.map(async (t) => {
      const pubKey = await fromBase64(t.publicKeyB64);
      const wrapped = await wrapConversationKey(ck, pubKey);
      return {
        deviceId: t.deviceId,
        wrappedKey: await toBase64(wrapped),
        keyEpoch,
      };
    }),
  );

  await uploadKeyWraps(conversationId, wraps);
  return ck;
}
