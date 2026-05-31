import { beforeAll, describe, expect, it } from 'vitest';
import type { Message } from '@mayday/shared';
import { getSodium } from '../../src/crypto/sodium.js';
import { toRenderable, renderMessages } from '../../src/crypto/render.js';
import { encryptToEnvelope } from '../../src/crypto/envelope.js';
import { generateConversationKey } from '../../src/crypto/conversation.js';

// Real libsodium round-trips. Vite aliases libsodium-wrappers to its CJS
// build (see vite.config.ts) so this works in jsdom too.
beforeAll(async () => {
  await getSodium();
});

function legacyMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    type: 'TEXT',
    metadata: null,
    content: 'hello',
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
    ...overrides,
  };
}

async function encryptedMessage(plaintext: string, ck: Uint8Array): Promise<Message> {
  const envelope = await encryptToEnvelope(plaintext, ck, '00000000-0000-4000-a000-000000000001', 1);
  return legacyMessage({
    content: null,
    ciphertext: envelope.ciphertext,
    nonce: envelope.nonce,
    senderDeviceId: envelope.senderDeviceId,
    keyEpoch: envelope.keyEpoch,
    protocolVersion: envelope.protocolVersion,
  });
}

describe('toRenderable', () => {
  it('marks legacy plaintext messages with status "legacy" and passes content through', async () => {
    const result = await toRenderable(legacyMessage({ content: 'hi from 2025' }), null);
    expect(result.encryptionStatus).toBe('legacy');
    expect(result.content).toBe('hi from 2025');
  });

  it('marks an encrypted message as pending when no CK is available', async () => {
    const ck = await generateConversationKey();
    const msg = await encryptedMessage('secret', ck);
    const result = await toRenderable(msg, null);
    expect(result.encryptionStatus).toBe('pending');
    // Placeholder content — we should NOT leak ciphertext bytes here.
    expect(result.content).not.toBe(msg.ciphertext);
    expect(result.content).toMatch(/Decrypting/);
  });

  it('decrypts an encrypted message when the correct CK is provided', async () => {
    const ck = await generateConversationKey();
    const msg = await encryptedMessage('the eagle has landed', ck);
    const result = await toRenderable(msg, ck);
    expect(result.encryptionStatus).toBe('encrypted');
    expect(result.content).toBe('the eagle has landed');
  });

  it('marks the message as "failed" when CK does not match', async () => {
    const ck1 = await generateConversationKey();
    const ck2 = await generateConversationKey();
    const msg = await encryptedMessage('should fail', ck1);
    const result = await toRenderable(msg, ck2);
    expect(result.encryptionStatus).toBe('failed');
    // Failed state must not surface the ciphertext or partial plaintext.
    expect(result.content).not.toContain('should fail');
  });

  it('passes invite messages through with their type and metadata intact', async () => {
    const metadata = {
      inviteKind: 'ORGANIZATION' as const,
      inviteId: 'inv1',
      targetId: 'org1',
      targetName: 'Acme Co',
      status: 'PENDING' as const,
    };
    const msg = legacyMessage({ type: 'INVITE', content: null, metadata });
    // No conversation key — an invite must not be treated as a pending
    // (waiting-for-key) encrypted message.
    const result = await toRenderable(msg, null);
    expect(result.type).toBe('INVITE');
    expect(result.metadata).toEqual(metadata);
    expect(result.encryptionStatus).not.toBe('pending');
  });
});

describe('renderMessages', () => {
  it('processes a mixed batch of legacy + encrypted messages', async () => {
    const ck = await generateConversationKey();
    const messages = [
      legacyMessage({ id: 'm1', content: 'old plain' }),
      await encryptedMessage('new secret', ck),
    ];
    const result = await renderMessages(messages, ck);
    expect(result.map((m) => m.encryptionStatus)).toEqual(['legacy', 'encrypted']);
    expect(result.map((m) => m.content)).toEqual(['old plain', 'new secret']);
  });
});
