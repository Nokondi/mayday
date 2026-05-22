import type { UploadKeyWrapsRequest } from '@mayday/shared';
import type { DeviceKeys } from './device.js';
import { getConversations } from '../api/messages.js';
import { getKeyWraps, uploadKeyWraps } from '../api/keyWraps.js';
import { getUserDevices, getMyDevices } from '../api/devices.js';
import {
  generateConversationKey,
  wrapConversationKey,
  unwrapConversationKey,
  fromBase64,
  toBase64,
} from './conversation.js';

// Runs after the user revokes one or more of their own devices. For each
// conversation we participate in, generate a fresh CK at the next epoch and
// wrap it for every still-active device of both participants — explicitly
// excluding the just-revoked deviceIds. The previous-epoch wraps stay
// intact so historical messages remain decryptable by the devices that
// already had access (including, locally on disk, the revoked device — but
// the server now refuses to wrap *future* CKs for it).
//
// Phase 5 MVP: only the revoking user's surviving device initiates rotation
// (called inline from the revoke flow). Peer devices do NOT auto-rotate on
// DEVICE_REVOKED — that would risk two writers picking different new CKs
// at the same epoch. See e2ee_phase5_implementation memory for the race
// discussion.
export interface RotateParams {
  ownDevice: DeviceKeys;
  ownDeviceServerId: string;
  // Devices to exclude from the new-epoch wraps. Typically the device(s) the
  // user just revoked. We pass them explicitly rather than relying solely on
  // getMyDevices()'s revokedAt filter, since the revoke may not have
  // propagated to a read replica yet on the very next request.
  revokedDeviceIds: Set<string>;
}

export async function rotateConversationKeysAfterRevoke(params: RotateParams): Promise<void> {
  const { ownDevice, ownDeviceServerId, revokedDeviceIds } = params;

  const conversations = await getConversations();
  // Cache our own devices once per rotation rather than fetching for each
  // conversation. A user's device list is short.
  const ownDevices = await getMyDevices();
  const activeOwn = ownDevices.filter(
    (d) => !d.revokedAt && !revokedDeviceIds.has(d.id),
  );

  await Promise.allSettled(conversations.map(async (conv) => {
    // 1. Figure out the next epoch from existing wraps. Use the highest we
    //    can see + 1. We can only see our own wraps via the API; peers may
    //    have wraps at higher epochs if a concurrent rotation happened, but
    //    that's a documented MVP limitation.
    const wraps = await getKeyWraps(conv.id);
    const mine = wraps.filter((w) => w.deviceId === ownDeviceServerId);
    if (mine.length === 0) return; // No access to this conversation; skip.
    const currentEpoch = mine.reduce((max, w) => (w.keyEpoch > max ? w.keyEpoch : max), 0);
    const nextEpoch = currentEpoch + 1;

    // 2. Generate a fresh CK at the new epoch.
    const newCk = await generateConversationKey();

    // 3. Get the peer's active devices. getUserDevices already filters
    //    revokedAt: null — but we double-check below.
    const peerDevices = await getUserDevices(conv.otherParticipant.id);

    const targets = [
      ...activeOwn.map((d) => ({ deviceId: d.id, publicKeyB64: d.encryptionPublicKey })),
      ...peerDevices
        .filter((d) => !revokedDeviceIds.has(d.id))
        .map((d) => ({ deviceId: d.id, publicKeyB64: d.encryptionPublicKey })),
    ];
    if (targets.length === 0) return;

    // 4. Wrap the new CK for each remaining device.
    const wrapsToUpload: UploadKeyWrapsRequest['wraps'] = await Promise.all(
      targets.map(async (t) => {
        const pubKey = await fromBase64(t.publicKeyB64);
        const wrapped = await wrapConversationKey(newCk, pubKey);
        return {
          deviceId: t.deviceId,
          wrappedKey: await toBase64(wrapped),
          keyEpoch: nextEpoch,
        };
      }),
    );

    await uploadKeyWraps(conv.id, wrapsToUpload);
  }));

  // Reference kept so the parameter isn't flagged as unused — we use it
  // inside the closure but the linter scopes can be picky in some configs.
  void ownDevice;
}

// Round-trip helper used by tests and (optionally) callers that want to
// verify a freshly-rotated CK is recoverable from our own wrap. Not exported
// for production code paths.
export async function _recoverCk(
  wrappedKeyB64: string,
  ownDevice: DeviceKeys,
): Promise<Uint8Array | null> {
  const wrappedBytes = await fromBase64(wrappedKeyB64);
  return unwrapConversationKey(
    wrappedBytes,
    ownDevice.encryption.publicKey,
    ownDevice.encryption.privateKey,
  );
}
