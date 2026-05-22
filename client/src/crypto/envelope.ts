import { getSodium } from './sodium.js';

// Wire format for an encrypted message body. Matches the shared
// EncryptedEnvelope type the server validates.
export interface Envelope {
  protocolVersion: 1;
  ciphertext: string;       // base64 of crypto_secretbox output
  nonce: string;            // base64 of the 24-byte nonce
  senderDeviceId: string;
  keyEpoch: number;
}

export async function encryptToEnvelope(
  plaintext: string,
  conversationKey: Uint8Array,
  senderDeviceId: string,
  keyEpoch: number,
): Promise<Envelope> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  // Pass the string directly: libsodium-wrappers auto-converts via its own
  // TextEncoder path. Pre-converting with s.from_string produces a Uint8Array
  // that fails the wrapper's `instanceof Uint8Array` guard in some test
  // realms (vitest/jsdom can hand out cross-realm typed arrays).
  const ciphertext = s.crypto_secretbox_easy(plaintext, nonce, conversationKey);
  return {
    protocolVersion: 1,
    ciphertext: s.to_base64(ciphertext, s.base64_variants.ORIGINAL),
    nonce: s.to_base64(nonce, s.base64_variants.ORIGINAL),
    senderDeviceId,
    keyEpoch,
  };
}

// Returns null when decryption fails. The caller treats null as "encrypted
// but unreadable" — this happens if the conversation key has rotated, the
// message was sent by a device whose wrap we don't have, or the ciphertext
// has been tampered with. Throwing here would crash the whole message list.
export async function decryptEnvelope(
  envelope: {
    protocolVersion: number | null;
    ciphertext: string | null;
    nonce: string | null;
  },
  conversationKey: Uint8Array,
): Promise<string | null> {
  if (envelope.protocolVersion !== 1 || !envelope.ciphertext || !envelope.nonce) {
    return null;
  }
  const s = await getSodium();
  try {
    const ciphertext = s.from_base64(envelope.ciphertext, s.base64_variants.ORIGINAL);
    const nonce = s.from_base64(envelope.nonce, s.base64_variants.ORIGINAL);
    const plaintext = s.crypto_secretbox_open_easy(ciphertext, nonce, conversationKey);
    return s.to_string(plaintext);
  } catch {
    return null;
  }
}
