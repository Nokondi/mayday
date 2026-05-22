import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Message } from '@mayday/shared';
import { useDecryptedMessages } from '../../src/hooks/useDecryptedMessages.js';
import { getSodium } from '../../src/crypto/sodium.js';
import { generateConversationKey } from '../../src/crypto/conversation.js';
import { encryptToEnvelope } from '../../src/crypto/envelope.js';

beforeAll(async () => {
  await getSodium();
});

function legacyMessage(content: string, id = 'm1'): Message {
  return {
    id,
    content,
    ciphertext: null,
    nonce: null,
    senderDeviceId: null,
    keyEpoch: null,
    protocolVersion: null,
    senderId: 'u2',
    receiverId: 'u1',
    conversationId: 'c1',
    readAt: null,
    createdAt: '2026-05-22T00:00:00Z',
  };
}

describe('useDecryptedMessages', () => {
  it('returns an empty array when raw messages is undefined', () => {
    const { result } = renderHook(() => useDecryptedMessages(undefined, null));
    expect(result.current).toEqual([]);
  });

  it('renders legacy plaintext as status "legacy" regardless of CK presence', async () => {
    const { result } = renderHook(() => useDecryptedMessages([legacyMessage('hi')], null));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].encryptionStatus).toBe('legacy');
    expect(result.current[0].content).toBe('hi');
  });

  it('decrypts encrypted messages when CK is provided', async () => {
    const ck = await generateConversationKey();
    const envelope = await encryptToEnvelope(
      'top secret',
      ck,
      '00000000-0000-4000-a000-000000000001',
      1,
    );
    const msg: Message = {
      ...legacyMessage('placeholder'),
      content: null,
      ciphertext: envelope.ciphertext,
      nonce: envelope.nonce,
      senderDeviceId: envelope.senderDeviceId,
      keyEpoch: envelope.keyEpoch,
      protocolVersion: envelope.protocolVersion,
    };

    const { result } = renderHook(() => useDecryptedMessages([msg], ck));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].encryptionStatus).toBe('encrypted');
    expect(result.current[0].content).toBe('top secret');
  });
});
