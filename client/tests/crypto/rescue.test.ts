import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/messages.js', () => ({
  getConversations: vi.fn(),
}));
vi.mock('../../src/api/keyWraps.js', () => ({
  getKeyWraps: vi.fn(),
  uploadKeyWraps: vi.fn(),
}));
vi.mock('../../src/api/devices.js', () => ({
  getMyDevices: vi.fn(),
  getUserDevices: vi.fn(),
}));

import { getConversations } from '../../src/api/messages.js';
import { getKeyWraps, uploadKeyWraps } from '../../src/api/keyWraps.js';
import { getMyDevices, getUserDevices } from '../../src/api/devices.js';
import {
  rescueConversationKeysForDevice,
  reconcileConversationKeys,
} from '../../src/crypto/rescue.js';
import { getSodium } from '../../src/crypto/sodium.js';
import {
  generateConversationKey,
  wrapConversationKey,
  unwrapConversationKey,
  toBase64,
  fromBase64,
} from '../../src/crypto/conversation.js';

const mockedGetConvs = vi.mocked(getConversations);
const mockedGetKeyWraps = vi.mocked(getKeyWraps);
const mockedUpload = vi.mocked(uploadKeyWraps);
const mockedGetMyDevices = vi.mocked(getMyDevices);
const mockedGetUserDevices = vi.mocked(getUserDevices);

const ME = '00000000-0000-4000-a000-000000000001';
const PEER = '00000000-0000-4000-a000-000000000002';
const MY_DEVICE = '00000000-0000-4000-a000-000000000010';
const NEW_DEVICE = '00000000-0000-4000-a000-000000000011';
const OTHER_OWN_DEVICE = '00000000-0000-4000-a000-000000000012';
const CONV_ID = '00000000-0000-4000-a000-000000000030';

beforeAll(async () => {
  await getSodium();
});

beforeEach(() => {
  vi.resetAllMocks();
});

async function makeDeviceKeys() {
  const s = await getSodium();
  const sign = s.crypto_sign_keypair();
  const enc = s.crypto_box_keypair();
  return {
    signing: { publicKey: sign.publicKey, privateKey: sign.privateKey },
    encryption: { publicKey: enc.publicKey, privateKey: enc.privateKey },
    encryptionKeySig: new Uint8Array(64),
    createdAt: Date.now(),
    serverId: null,
  };
}

async function makePeerDevice(id: string, userId: string) {
  const s = await getSodium();
  const sign = s.crypto_sign_keypair();
  const enc = s.crypto_box_keypair();
  return {
    peerDevice: {
      id,
      userId,
      signingPublicKey: await toBase64(sign.publicKey),
      encryptionPublicKey: await toBase64(enc.publicKey),
      encryptionKeySig: await toBase64(new Uint8Array(64)),
      createdAt: '2026-05-22T00:00:00Z',
    },
    privateEncryption: enc.privateKey,
    publicEncryption: enc.publicKey,
  };
}

function makeConv(otherId: string, id = CONV_ID) {
  return {
    id,
    participantAId: ME,
    participantBId: otherId,
    createdAt: '2026-05-22T00:00:00Z',
    updatedAt: '2026-05-22T00:00:00Z',
    otherParticipant: {
      id: otherId,
      name: 'Bob',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      links: null,
      createdAt: '2026-05-22T00:00:00Z',
    },
    lastMessage: null,
    unreadCount: 0,
  };
}

describe('rescueConversationKeysForDevice', () => {
  it('does nothing if newDevice is our own current device (no-op guard)', async () => {
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(MY_DEVICE, ME);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    expect(mockedGetConvs).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('peer-rescue: wraps CK for the new peer device and uploads', async () => {
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);

    // The conversation key Alice (us) already holds.
    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
    ]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [calledConvId, wraps] = mockedUpload.mock.calls[0]!;
    expect(calledConvId).toBe(CONV_ID);
    expect(wraps).toHaveLength(1);
    expect(wraps[0].deviceId).toBe(NEW_DEVICE);
    expect(wraps[0].keyEpoch).toBe(1);

    // Bob's new device must actually be able to decrypt with the wrap we uploaded.
    const uploadedBytes = await fromBase64(wraps[0].wrappedKey);
    const recovered = await unwrapConversationKey(
      uploadedBytes,
      newPeer.publicEncryption,
      newPeer.privateEncryption,
    );
    expect(recovered).not.toBeNull();
    expect(Array.from(recovered!)).toEqual(Array.from(ck));
  });

  it('own-handoff: walks all of our conversations regardless of which peer is involved', async () => {
    const ownDevice = await makeDeviceKeys();
    const newOwnDevice = await makePeerDevice(NEW_DEVICE, ME);

    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);
    const wrap = {
      id: 'kw1',
      conversationId: CONV_ID,
      deviceId: MY_DEVICE,
      wrappedKey: await toBase64(wrappedForMe),
      keyEpoch: 1,
      createdAt: '2026-05-22T00:00:00Z',
    };

    mockedGetConvs.mockResolvedValueOnce([
      makeConv(PEER, CONV_ID),
      makeConv('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000031'),
    ]);
    // Both conversations return a wrap addressed to us.
    mockedGetKeyWraps.mockResolvedValue([wrap]);
    mockedUpload.mockResolvedValue(undefined);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newOwnDevice.peerDevice,
    });

    // Both conversations get a wrap uploaded for the new own device.
    expect(mockedUpload).toHaveBeenCalledTimes(2);
  });

  it('skips conversations where we have no wrap (we can\'t share what we don\'t have)', async () => {
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetKeyWraps.mockResolvedValueOnce([]); // no wraps for us in this conv

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('skips when the new device already has a wrap at the same epoch (race-safe)', async () => {
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);

    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);
    const wrappedForNewDevice = await wrapConversationKey(ck, newPeer.publicEncryption);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
      {
        id: 'kw2',
        conversationId: CONV_ID,
        deviceId: NEW_DEVICE,
        wrappedKey: await toBase64(wrappedForNewDevice),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
    ]);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    // Another own device (or a previous run) already wrapped for this device
    // at this epoch — we shouldn't pile on another upload.
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('Phase 5: wraps for EVERY epoch the rescuer holds, so the new device can decrypt history', async () => {
    // Conversation has been rotated — the rescuer (us) holds wraps at both
    // epoch 1 and epoch 2. The new device must receive BOTH so it can decrypt
    // historical messages from before the rotation.
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);

    const ckEpoch1 = await generateConversationKey();
    const ckEpoch2 = await generateConversationKey();
    const wrappedE1 = await wrapConversationKey(ckEpoch1, ownDevice.encryption.publicKey);
    const wrappedE2 = await wrapConversationKey(ckEpoch2, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE1),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
      {
        id: 'kw2',
        conversationId: CONV_ID,
        deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE2),
        keyEpoch: 2,
        createdAt: '2026-05-22T01:00:00Z',
      },
    ]);
    mockedUpload.mockResolvedValue(undefined);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, wraps] = mockedUpload.mock.calls[0]!;
    expect(wraps).toHaveLength(2);
    const epochs = wraps.map((w) => w.keyEpoch).sort();
    expect(epochs).toEqual([1, 2]);

    // Each uploaded wrap must decrypt to the right CK for its epoch.
    const e1Wrap = wraps.find((w) => w.keyEpoch === 1)!;
    const e2Wrap = wraps.find((w) => w.keyEpoch === 2)!;
    const recoveredE1 = await unwrapConversationKey(
      await fromBase64(e1Wrap.wrappedKey),
      newPeer.publicEncryption,
      newPeer.privateEncryption,
    );
    const recoveredE2 = await unwrapConversationKey(
      await fromBase64(e2Wrap.wrappedKey),
      newPeer.publicEncryption,
      newPeer.privateEncryption,
    );
    expect(Array.from(recoveredE1!)).toEqual(Array.from(ckEpoch1));
    expect(Array.from(recoveredE2!)).toEqual(Array.from(ckEpoch2));
  });

  it('Phase 5: skips per-epoch when the new device already has a wrap at that specific epoch', async () => {
    // The new device already has a wrap at epoch 1 (perhaps from another own
    // device that rescued it first). Our rescue must skip epoch 1 but still
    // upload epoch 2 since that wrap is missing.
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);

    const ckE1 = await generateConversationKey();
    const ckE2 = await generateConversationKey();
    const wrappedE1Me = await wrapConversationKey(ckE1, ownDevice.encryption.publicKey);
    const wrappedE1New = await wrapConversationKey(ckE1, newPeer.publicEncryption);
    const wrappedE2Me = await wrapConversationKey(ckE2, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      // Our wraps at both epochs
      {
        id: 'kw-me-1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE1Me), keyEpoch: 1, createdAt: '',
      },
      {
        id: 'kw-me-2', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE2Me), keyEpoch: 2, createdAt: '',
      },
      // New device ALREADY has a wrap at epoch 1 (rescued by someone else)
      {
        id: 'kw-new-1', conversationId: CONV_ID, deviceId: NEW_DEVICE,
        wrappedKey: await toBase64(wrappedE1New), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedUpload.mockResolvedValue(undefined);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, wraps] = mockedUpload.mock.calls[0]!;
    // Only epoch 2 should be uploaded — epoch 1 was already covered.
    expect(wraps).toHaveLength(1);
    expect(wraps[0].keyEpoch).toBe(2);
  });

  it('peer-rescue filters out conversations where the new device\'s owner is NOT a participant', async () => {
    const ownDevice = await makeDeviceKeys();
    const newPeer = await makePeerDevice(NEW_DEVICE, PEER);
    const unrelatedPeer = '00000000-0000-4000-a000-000000000004';

    mockedGetConvs.mockResolvedValueOnce([
      makeConv(unrelatedPeer, '00000000-0000-4000-a000-000000000032'),
    ]);

    await rescueConversationKeysForDevice({
      currentUserId: ME,
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      newDevice: newPeer.peerDevice,
    });

    // The conversation is with someone else, not the new device's owner.
    // We must NOT fetch its wraps or upload — that would leak our CK to
    // an unrelated user's new device.
    expect(mockedGetKeyWraps).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});

// A Device row as returned by getMyDevices (our own devices, including the
// current one). Only id/encryptionPublicKey/revokedAt matter to the sweep.
function makeMyDeviceRow(
  id: string,
  encryptionPublicKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    userId: ME,
    label: null,
    signingPublicKey: 'AAAA',
    encryptionPublicKey,
    encryptionKeySig: 'AAAA',
    createdAt: '2026-05-22T00:00:00Z',
    lastSeenAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe('reconcileConversationKeys (on-connect recovery sweep)', () => {
  it('wraps the CK for an active peer device that is missing it', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makePeerDevice(NEW_DEVICE, PEER);
    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      makeMyDeviceRow(MY_DEVICE, await toBase64(ownDevice.encryption.publicKey)),
    ] as never);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.peerDevice]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await reconcileConversationKeys({ ownDevice, ownDeviceServerId: MY_DEVICE });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [convId, wraps] = mockedUpload.mock.calls[0]!;
    expect(convId).toBe(CONV_ID);
    expect(wraps).toHaveLength(1);
    expect(wraps[0].deviceId).toBe(NEW_DEVICE);

    // The peer's device must actually be able to decrypt the wrap we uploaded.
    const recovered = await unwrapConversationKey(
      await fromBase64(wraps[0].wrappedKey),
      peer.publicEncryption,
      peer.privateEncryption,
    );
    expect(Array.from(recovered!)).toEqual(Array.from(ck));
  });

  it('skips a conversation where we do not hold the CK (no peer lookup, no upload)', async () => {
    const ownDevice = await makeDeviceKeys();

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      makeMyDeviceRow(MY_DEVICE, await toBase64(ownDevice.encryption.publicKey)),
    ] as never);
    mockedGetKeyWraps.mockResolvedValueOnce([]); // no wrap addressed to us

    await reconcileConversationKeys({ ownDevice, ownDeviceServerId: MY_DEVICE });

    // We can't share a key we don't have — and must not even enumerate the
    // peer's devices for a conversation we have no access to.
    expect(mockedGetUserDevices).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('also wraps for our own other devices (multi-device handoff)', async () => {
    const ownDevice = await makeDeviceKeys();
    const otherOwn = await makePeerDevice(OTHER_OWN_DEVICE, ME);
    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      makeMyDeviceRow(MY_DEVICE, await toBase64(ownDevice.encryption.publicKey)),
      makeMyDeviceRow(OTHER_OWN_DEVICE, otherOwn.peerDevice.encryptionPublicKey),
    ] as never);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([]); // peer has no devices
    mockedUpload.mockResolvedValueOnce(undefined);

    await reconcileConversationKeys({ ownDevice, ownDeviceServerId: MY_DEVICE });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, wraps] = mockedUpload.mock.calls[0]!;
    expect(wraps).toHaveLength(1);
    // Our own *current* device must never be a target; only the other one.
    expect(wraps[0].deviceId).toBe(OTHER_OWN_DEVICE);

    const recovered = await unwrapConversationKey(
      await fromBase64(wraps[0].wrappedKey),
      otherOwn.publicEncryption,
      otherOwn.privateEncryption,
    );
    expect(Array.from(recovered!)).toEqual(Array.from(ck));
  });

  it('does not re-wrap a device that already holds the epoch (quiet when in sync)', async () => {
    const ownDevice = await makeDeviceKeys();
    const otherOwn = await makePeerDevice(OTHER_OWN_DEVICE, ME);
    const ck = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(ck, ownDevice.encryption.publicKey);
    const wrappedForOther = await wrapConversationKey(ck, otherOwn.publicEncryption);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      makeMyDeviceRow(MY_DEVICE, await toBase64(ownDevice.encryption.publicKey)),
      makeMyDeviceRow(OTHER_OWN_DEVICE, otherOwn.peerDevice.encryptionPublicKey),
    ] as never);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe), keyEpoch: 1, createdAt: '',
      },
      {
        id: 'kw2', conversationId: CONV_ID, deviceId: OTHER_OWN_DEVICE,
        wrappedKey: await toBase64(wrappedForOther), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([]); // peer has no devices

    await reconcileConversationKeys({ ownDevice, ownDeviceServerId: MY_DEVICE });

    // Every visible target already has the epoch — nothing to upload.
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('wraps every epoch we hold for a peer device so it can read full history', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makePeerDevice(NEW_DEVICE, PEER);
    const ck1 = await generateConversationKey();
    const ck2 = await generateConversationKey();
    const wrappedE1 = await wrapConversationKey(ck1, ownDevice.encryption.publicKey);
    const wrappedE2 = await wrapConversationKey(ck2, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      makeMyDeviceRow(MY_DEVICE, await toBase64(ownDevice.encryption.publicKey)),
    ] as never);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE1), keyEpoch: 1, createdAt: '',
      },
      {
        id: 'kw2', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE2), keyEpoch: 2, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.peerDevice]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await reconcileConversationKeys({ ownDevice, ownDeviceServerId: MY_DEVICE });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [, wraps] = mockedUpload.mock.calls[0]!;
    expect(wraps.map((w) => w.keyEpoch).sort()).toEqual([1, 2]);
    expect(wraps.every((w) => w.deviceId === NEW_DEVICE)).toBe(true);
  });
});
