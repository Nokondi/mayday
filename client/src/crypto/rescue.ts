import type { ConversationKeyWrap, PeerDevice, UploadKeyWrapsRequest } from '@mayday/shared';
import type { DeviceKeys } from './device.js';
import { getConversations } from '../api/messages.js';
import { getMyDevices, getUserDevices } from '../api/devices.js';
import { getKeyWraps, uploadKeyWraps } from '../api/keyWraps.js';
import { unwrapConversationKey, wrapConversationKey, fromBase64, toBase64 } from './conversation.js';

// A device we want to hand the conversation key to. Both Device and PeerDevice
// satisfy this shape — we only ever need its id and encryption public key.
interface WrapTarget {
  id: string;
  encryptionPublicKey: string;
}

// Core wrapping primitive shared by the event-driven rescue and the
// on-connect reconciliation sweep. Given the wraps we can see for a single
// conversation (`getKeyWraps` returns only our *own user's* device wraps) and
// a list of target devices, produce the wraps needed so every target holds
// the CK at every epoch we hold.
//
// We unwrap each epoch's CK once (cached) rather than per target. A target is
// skipped for an epoch only when we can already see a wrap for it at that
// epoch — which, since the server only returns our own user's wraps, means
// the skip is effective for own devices but never fires for peer devices.
// That's fine: re-wrapping a peer device is idempotent server-side (upsert),
// and the alternative (enumerating a peer's wraps) would leak the peer's
// device provisioning state.
async function buildMissingWraps(
  visibleWraps: ConversationKeyWrap[],
  ownDevice: DeviceKeys,
  ownDeviceServerId: string,
  targets: WrapTarget[],
): Promise<UploadKeyWrapsRequest['wraps']> {
  const ourWraps = visibleWraps.filter((w) => w.deviceId === ownDeviceServerId);
  if (ourWraps.length === 0) return []; // We don't hold this conversation's CK.

  // Unwrap each epoch's CK once. Map iteration order is insertion order, which
  // doesn't matter here since every missing epoch gets its own wrap.
  const ckByEpoch = new Map<number, Uint8Array>();
  for (const w of ourWraps) {
    if (ckByEpoch.has(w.keyEpoch)) continue;
    const ck = await unwrapConversationKey(
      await fromBase64(w.wrappedKey),
      ownDevice.encryption.publicKey,
      ownDevice.encryption.privateKey,
    );
    if (ck) ckByEpoch.set(w.keyEpoch, ck);
  }

  const out: UploadKeyWrapsRequest['wraps'] = [];
  for (const target of targets) {
    // Never wrap for ourselves: we'd be sealing to a public key whose private
    // key we already have. Pointless, and it would mask bugs by succeeding.
    if (target.id === ownDeviceServerId) continue;

    const have = new Set(
      visibleWraps.filter((w) => w.deviceId === target.id).map((w) => w.keyEpoch),
    );
    const pubKey = await fromBase64(target.encryptionPublicKey);
    for (const [epoch, ck] of ckByEpoch) {
      if (have.has(epoch)) continue;
      out.push({
        deviceId: target.id,
        wrappedKey: await toBase64(await wrapConversationKey(ck, pubKey)),
        keyEpoch: epoch,
      });
    }
  }
  return out;
}

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

  await Promise.allSettled(targetConversations.map(async (conv) => {
    const wraps = await getKeyWraps(conv.id);
    const wrapsToUpload = await buildMissingWraps(wraps, ownDevice, ownDeviceServerId, [
      { id: newDevice.id, encryptionPublicKey: newDevice.encryptionPublicKey },
    ]);
    if (wrapsToUpload.length === 0) return;
    await uploadKeyWraps(conv.id, wrapsToUpload);
  }));
}

// Recovery sweep run whenever we (re)connect to the WebSocket. DEVICE_ADDED is
// a one-shot, fire-and-forget event: if the device holding a conversation's CK
// wasn't connected at the instant a new device registered, that event is gone
// and the new device is left unable to decrypt — with no retry path. This
// sweep closes that gap by making handoff/rescue eventually-consistent: for
// every conversation where we hold the CK, ensure every *currently active*
// participant device (the peer's devices and our own other devices) has a wrap
// at each epoch we hold.
//
// Symmetric and safe to run on every device: a device that doesn't hold a
// conversation's CK simply skips it (buildMissingWraps returns nothing), so a
// freshly-enrolled device can't (and shouldn't) self-rescue — it waits for a
// holder's sweep or a live DEVICE_ADDED. The work is bounded by our own
// conversation count; uploads are idempotent so redundant passes are cheap.
export interface ReconcileParams {
  ownDevice: DeviceKeys;
  ownDeviceServerId: string;
}

export async function reconcileConversationKeys(params: ReconcileParams): Promise<void> {
  const { ownDevice, ownDeviceServerId } = params;

  const [conversations, myDevices] = await Promise.all([
    getConversations(),
    getMyDevices(),
  ]);
  const ownOtherTargets: WrapTarget[] = myDevices
    .filter((d) => !d.revokedAt && d.id !== ownDeviceServerId)
    .map((d) => ({ id: d.id, encryptionPublicKey: d.encryptionPublicKey }));

  await Promise.allSettled(conversations.map(async (conv) => {
    const wraps = await getKeyWraps(conv.id);
    // Bail before fetching peer devices if we don't hold this CK anyway.
    if (!wraps.some((w) => w.deviceId === ownDeviceServerId)) return;

    const peerDevices = await getUserDevices(conv.otherParticipant.id);
    const targets: WrapTarget[] = [
      ...peerDevices.map((d) => ({ id: d.id, encryptionPublicKey: d.encryptionPublicKey })),
      ...ownOtherTargets,
    ];

    const wrapsToUpload = await buildMissingWraps(wraps, ownDevice, ownDeviceServerId, targets);
    if (wrapsToUpload.length === 0) return;
    await uploadKeyWraps(conv.id, wrapsToUpload);
  }));
}
