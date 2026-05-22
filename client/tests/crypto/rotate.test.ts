import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/messages.js', () => ({
  getConversations: vi.fn(),
}));
vi.mock('../../src/api/keyWraps.js', () => ({
  getKeyWraps: vi.fn(),
  uploadKeyWraps: vi.fn(),
}));
vi.mock('../../src/api/devices.js', () => ({
  getUserDevices: vi.fn(),
  getMyDevices: vi.fn(),
}));

import { getConversations } from '../../src/api/messages.js';
import { getKeyWraps, uploadKeyWraps } from '../../src/api/keyWraps.js';
import { getUserDevices, getMyDevices } from '../../src/api/devices.js';
import { rotateConversationKeysAfterRevoke } from '../../src/crypto/rotate.js';
import { getSodium } from '../../src/crypto/sodium.js';
import {
  generateConversationKey,
  wrapConversationKey,
  unwrapConversationKey,
  fromBase64,
  toBase64,
} from '../../src/crypto/conversation.js';

const mockedGetConvs = vi.mocked(getConversations);
const mockedGetKeyWraps = vi.mocked(getKeyWraps);
const mockedUpload = vi.mocked(uploadKeyWraps);
const mockedGetUserDevices = vi.mocked(getUserDevices);
const mockedGetMyDevices = vi.mocked(getMyDevices);

const ME = '00000000-0000-4000-a000-000000000001';
const PEER = '00000000-0000-4000-a000-000000000002';
const MY_DEVICE = '00000000-0000-4000-a000-000000000010';
const MY_OTHER_DEVICE = '00000000-0000-4000-a000-000000000011';
const REVOKED_DEVICE = '00000000-0000-4000-a000-000000000012';
const PEER_DEVICE = '00000000-0000-4000-a000-000000000020';
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

async function makeDeviceWithKeys(id: string, userId: string, revokedAt: string | null = null) {
  const s = await getSodium();
  const sign = s.crypto_sign_keypair();
  const enc = s.crypto_box_keypair();
  return {
    publicKeys: {
      id,
      userId,
      signingPublicKey: await toBase64(sign.publicKey),
      encryptionPublicKey: await toBase64(enc.publicKey),
      encryptionKeySig: await toBase64(new Uint8Array(64)),
      label: null,
      createdAt: '2026-05-22T00:00:00Z',
      lastSeenAt: null,
      revokedAt,
    },
    publicEncryption: enc.publicKey,
    privateEncryption: enc.privateKey,
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

describe('rotateConversationKeysAfterRevoke', () => {
  it('generates a new CK at the next epoch and wraps for remaining own + peer devices', async () => {
    const ownDevice = await makeDeviceKeys();
    const otherOwn = await makeDeviceWithKeys(MY_OTHER_DEVICE, ME);
    const revoked = await makeDeviceWithKeys(REVOKED_DEVICE, ME);
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);

    // Existing wraps at epoch 1 — we want the rotation to produce epoch 2.
    const oldCk = await generateConversationKey();
    const wrappedForMe = await wrapConversationKey(oldCk, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      // Current device (the rotator)
      { id: MY_DEVICE, userId: ME, signingPublicKey: 'x', encryptionPublicKey: await toBase64(ownDevice.encryption.publicKey), encryptionKeySig: 'x', label: null, createdAt: '', lastSeenAt: null, revokedAt: null },
      otherOwn.publicKeys,
      revoked.publicKeys,
    ]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedForMe), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set([REVOKED_DEVICE]),
    });

    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [calledConvId, wraps] = mockedUpload.mock.calls[0]!;
    expect(calledConvId).toBe(CONV_ID);

    // New epoch = current max + 1
    for (const w of wraps) expect(w.keyEpoch).toBe(2);

    // Targets: current device, other own device, peer device.
    // Revoked device must NOT be in the wraps.
    const targetIds = wraps.map((w) => w.deviceId).sort();
    expect(targetIds).toEqual([MY_DEVICE, MY_OTHER_DEVICE, PEER_DEVICE].sort());
    expect(targetIds).not.toContain(REVOKED_DEVICE);
  });

  it('produces a DIFFERENT CK than the previous epoch (rotation actually rotates)', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);
    const revoked = await makeDeviceWithKeys(REVOKED_DEVICE, ME);

    const oldCk = await generateConversationKey();
    const wrappedOld = await wrapConversationKey(oldCk, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { id: MY_DEVICE, userId: ME, signingPublicKey: 'x', encryptionPublicKey: await toBase64(ownDevice.encryption.publicKey), encryptionKeySig: 'x', label: null, createdAt: '', lastSeenAt: null, revokedAt: null },
      revoked.publicKeys,
    ]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedOld), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set([REVOKED_DEVICE]),
    });

    const [, wraps] = mockedUpload.mock.calls[0]!;
    const myNewWrap = wraps.find((w) => w.deviceId === MY_DEVICE)!;
    const newCk = await unwrapConversationKey(
      await fromBase64(myNewWrap.wrappedKey),
      ownDevice.encryption.publicKey,
      ownDevice.encryption.privateKey,
    );
    expect(newCk).not.toBeNull();
    expect(Array.from(newCk!)).not.toEqual(Array.from(oldCk));
  });

  it('peer device wrapping at the new epoch round-trips: peer can recover the new CK', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);

    const oldCk = await generateConversationKey();
    const wrappedOld = await wrapConversationKey(oldCk, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { id: MY_DEVICE, userId: ME, signingPublicKey: 'x', encryptionPublicKey: await toBase64(ownDevice.encryption.publicKey), encryptionKeySig: 'x', label: null, createdAt: '', lastSeenAt: null, revokedAt: null },
    ]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedOld), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set(),
    });

    const [, wraps] = mockedUpload.mock.calls[0]!;
    const peerWrap = wraps.find((w) => w.deviceId === PEER_DEVICE)!;
    const recovered = await unwrapConversationKey(
      await fromBase64(peerWrap.wrappedKey),
      peer.publicEncryption,
      peer.privateEncryption,
    );
    expect(recovered).not.toBeNull();
    // The peer's recovered CK matches our own recovered CK (both unwrap the
    // same fresh CK we generated).
    const myWrap = wraps.find((w) => w.deviceId === MY_DEVICE)!;
    const myRecovered = await unwrapConversationKey(
      await fromBase64(myWrap.wrappedKey),
      ownDevice.encryption.publicKey,
      ownDevice.encryption.privateKey,
    );
    expect(Array.from(recovered!)).toEqual(Array.from(myRecovered!));
  });

  it('skips conversations where we have no wrap (we can\'t recover the CK to rotate)', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([]);
    mockedGetKeyWraps.mockResolvedValueOnce([]); // no wraps for anyone
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set([REVOKED_DEVICE]),
    });

    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('computes next epoch as max-existing + 1 across multiple existing epochs', async () => {
    const ownDevice = await makeDeviceKeys();
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);

    const ckE5 = await generateConversationKey();
    const wrappedE5 = await wrapConversationKey(ckE5, ownDevice.encryption.publicKey);
    const ckE3 = await generateConversationKey();
    const wrappedE3 = await wrapConversationKey(ckE3, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { id: MY_DEVICE, userId: ME, signingPublicKey: 'x', encryptionPublicKey: await toBase64(ownDevice.encryption.publicKey), encryptionKeySig: 'x', label: null, createdAt: '', lastSeenAt: null, revokedAt: null },
    ]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      // Epochs out of order on the wire to make sure we don't rely on order.
      {
        id: 'kw-e3', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE3), keyEpoch: 3, createdAt: '',
      },
      {
        id: 'kw-e5', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedE5), keyEpoch: 5, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set(),
    });

    const [, wraps] = mockedUpload.mock.calls[0]!;
    for (const w of wraps) expect(w.keyEpoch).toBe(6);
  });

  it('explicitly excludes a peer device that is in revokedDeviceIds', async () => {
    // Edge case: in practice users only revoke their own devices, but the
    // helper accepts any deviceId. Verifies the filter is honored on peers too.
    const ownDevice = await makeDeviceKeys();
    const peer = await makeDeviceWithKeys(PEER_DEVICE, PEER);

    const oldCk = await generateConversationKey();
    const wrappedOld = await wrapConversationKey(oldCk, ownDevice.encryption.publicKey);

    mockedGetConvs.mockResolvedValueOnce([makeConv(PEER)]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { id: MY_DEVICE, userId: ME, signingPublicKey: 'x', encryptionPublicKey: await toBase64(ownDevice.encryption.publicKey), encryptionKeySig: 'x', label: null, createdAt: '', lastSeenAt: null, revokedAt: null },
    ]);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1', conversationId: CONV_ID, deviceId: MY_DEVICE,
        wrappedKey: await toBase64(wrappedOld), keyEpoch: 1, createdAt: '',
      },
    ]);
    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await rotateConversationKeysAfterRevoke({
      ownDevice,
      ownDeviceServerId: MY_DEVICE,
      revokedDeviceIds: new Set([PEER_DEVICE]),
    });

    const [, wraps] = mockedUpload.mock.calls[0]!;
    const ids = wraps.map((w) => w.deviceId);
    expect(ids).not.toContain(PEER_DEVICE);
  });
});
