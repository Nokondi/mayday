import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/context/DeviceContext.js', () => ({
  useDevice: vi.fn(),
}));
vi.mock('../../src/api/keyWraps.js', () => ({
  getKeyWraps: vi.fn(),
}));

import { useDevice } from '../../src/context/DeviceContext.js';
import { getKeyWraps } from '../../src/api/keyWraps.js';
import { useConversationKey } from '../../src/hooks/useConversationKey.js';
import { getSodium } from '../../src/crypto/sodium.js';
import {
  generateConversationKey,
  wrapConversationKey,
  toBase64,
} from '../../src/crypto/conversation.js';

const mockedUseDevice = vi.mocked(useDevice);
const mockedGetKeyWraps = vi.mocked(getKeyWraps);

const SERVER_DEVICE_ID = '00000000-0000-4000-a000-000000000010';
const CONV_ID = '00000000-0000-4000-a000-000000000020';

beforeAll(async () => {
  await getSodium();
});

beforeEach(() => {
  vi.resetAllMocks();
});

async function makeMockDevice() {
  const s = await getSodium();
  const signing = s.crypto_sign_keypair();
  const encryption = s.crypto_box_keypair();
  return {
    device: {
      serverId: SERVER_DEVICE_ID,
      signing: { publicKey: signing.publicKey, privateKey: signing.privateKey },
      encryption: { publicKey: encryption.publicKey, privateKey: encryption.privateKey },
      encryptionKeySig: new Uint8Array(64),
      createdAt: Date.now(),
    },
    serverId: SERVER_DEVICE_ID,
    error: null,
  };
}

describe('useConversationKey', () => {
  it('returns null when no conversationId is provided', async () => {
    mockedUseDevice.mockReturnValue(await makeMockDevice());
    const { result } = renderHook(() => useConversationKey(null));
    expect(result.current).toBeNull();
  });

  it('returns null when there is no wrap addressed to this device', async () => {
    const ctx = await makeMockDevice();
    mockedUseDevice.mockReturnValue(ctx);
    mockedGetKeyWraps.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useConversationKey(CONV_ID));
    // Give the effect a chance to run; hook should still resolve to null.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });

  it('unwraps the conversation key when a wrap for this device exists', async () => {
    const ctx = await makeMockDevice();
    mockedUseDevice.mockReturnValue(ctx);

    const ck = await generateConversationKey();
    const wrapped = await wrapConversationKey(ck, ctx.device.encryption.publicKey);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: SERVER_DEVICE_ID,
        wrappedKey: await toBase64(wrapped),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
    ]);

    const { result } = renderHook(() => useConversationKey(CONV_ID));
    await waitFor(() => expect(result.current).not.toBeNull());

    // The CK we recover must be byte-identical to the one we sealed.
    expect(Array.from(result.current!)).toEqual(Array.from(ck));
  });

  it('ignores wraps addressed to a different device', async () => {
    const ctx = await makeMockDevice();
    mockedUseDevice.mockReturnValue(ctx);

    // Wrap with a different keypair — the unwrap with our keys must fail.
    const s = await getSodium();
    const otherKp = s.crypto_box_keypair();
    const ck = await generateConversationKey();
    const wrappedToOther = await wrapConversationKey(ck, otherKp.publicKey);
    mockedGetKeyWraps.mockResolvedValueOnce([
      {
        id: 'kw1',
        conversationId: CONV_ID,
        deviceId: 'some-other-device',
        wrappedKey: await toBase64(wrappedToOther),
        keyEpoch: 1,
        createdAt: '2026-05-22T00:00:00Z',
      },
    ]);

    const { result } = renderHook(() => useConversationKey(CONV_ID));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });
});
