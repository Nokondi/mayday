import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/devices.js', () => ({
  getUserDevices: vi.fn(),
  getMyDevices: vi.fn(),
}));
vi.mock('../../src/api/keyWraps.js', () => ({
  uploadKeyWraps: vi.fn(),
}));

import { getUserDevices, getMyDevices } from '../../src/api/devices.js';
import { uploadKeyWraps } from '../../src/api/keyWraps.js';
import { establishConversationKey } from '../../src/crypto/establish.js';
import { getSodium } from '../../src/crypto/sodium.js';
import { toBase64, fromBase64, unwrapConversationKey } from '../../src/crypto/conversation.js';

const mockedGetUserDevices = vi.mocked(getUserDevices);
const mockedGetMyDevices = vi.mocked(getMyDevices);
const mockedUpload = vi.mocked(uploadKeyWraps);

const PEER_USER_ID = '00000000-0000-4000-a000-000000000002';
const OWN_DEVICE_ID = '00000000-0000-4000-a000-000000000010';
const PEER_DEVICE_ID = '00000000-0000-4000-a000-000000000020';
const CONV_ID = '00000000-0000-4000-a000-000000000030';

beforeAll(async () => {
  await getSodium();
});

beforeEach(() => {
  vi.resetAllMocks();
});

async function makeDevicePublicKeys(id: string, userId: string) {
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
      createdAt: '2026-05-22T00:00:00Z',
    },
    privateEncryption: enc.privateKey,
    publicEncryption: enc.publicKey,
  };
}

describe('establishConversationKey', () => {
  it('returns null when the peer has no devices (caller will fall back to plaintext)', async () => {
    mockedGetUserDevices.mockResolvedValueOnce([]);
    mockedGetMyDevices.mockResolvedValueOnce([]);

    const result = await establishConversationKey(CONV_ID, PEER_USER_ID, OWN_DEVICE_ID);

    expect(result).toBeNull();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('generates a CK, wraps it for the peer device and own device, and uploads', async () => {
    const peer = await makeDevicePublicKeys(PEER_DEVICE_ID, PEER_USER_ID);
    const own = await makeDevicePublicKeys(OWN_DEVICE_ID, 'me');

    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { ...own.publicKeys, label: null, lastSeenAt: null, revokedAt: null },
    ]);
    mockedUpload.mockResolvedValueOnce(undefined);

    const ck = await establishConversationKey(CONV_ID, PEER_USER_ID, OWN_DEVICE_ID);

    expect(ck).not.toBeNull();
    expect(mockedUpload).toHaveBeenCalledTimes(1);
    const [calledConvId, wraps] = mockedUpload.mock.calls[0]!;
    expect(calledConvId).toBe(CONV_ID);
    expect(wraps).toHaveLength(2);
    const deviceIds = wraps.map((w) => w.deviceId).sort();
    expect(deviceIds).toEqual([OWN_DEVICE_ID, PEER_DEVICE_ID].sort());

    // The wrap addressed to the peer device must actually decrypt with the
    // peer's private key — verifies the seal targets the right public key
    // and the byte-level round-trip works end-to-end.
    const peerWrap = wraps.find((w) => w.deviceId === PEER_DEVICE_ID)!;
    const wrappedBytes = await fromBase64(peerWrap.wrappedKey);
    const recovered = await unwrapConversationKey(wrappedBytes, peer.publicEncryption, peer.privateEncryption);
    expect(recovered).not.toBeNull();
    expect(Array.from(recovered!)).toEqual(Array.from(ck!));
  });

  it('skips revoked own devices when wrapping', async () => {
    const peer = await makeDevicePublicKeys(PEER_DEVICE_ID, PEER_USER_ID);
    const own = await makeDevicePublicKeys(OWN_DEVICE_ID, 'me');
    const revokedOwn = await makeDevicePublicKeys('00000000-0000-4000-a000-000000000011', 'me');

    mockedGetUserDevices.mockResolvedValueOnce([peer.publicKeys]);
    mockedGetMyDevices.mockResolvedValueOnce([
      { ...own.publicKeys, label: null, lastSeenAt: null, revokedAt: null },
      { ...revokedOwn.publicKeys, label: null, lastSeenAt: null, revokedAt: '2026-01-01T00:00:00Z' },
    ]);
    mockedUpload.mockResolvedValueOnce(undefined);

    await establishConversationKey(CONV_ID, PEER_USER_ID, OWN_DEVICE_ID);

    const [, wraps] = mockedUpload.mock.calls[0]!;
    const deviceIds = wraps.map((w) => w.deviceId);
    expect(deviceIds).not.toContain('00000000-0000-4000-a000-000000000011');
  });
});
