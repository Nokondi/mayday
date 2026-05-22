import { getSodium } from './sodium.js';

// A conversation key (CK) is a random 32-byte symmetric key. The conversation
// initiator generates one, then seals it to each recipient device's X25519
// public key with crypto_box_seal — the seal is anonymous (no sender
// authentication) but that's fine here because all the device public keys
// are signed by their owners' Ed25519 identity keys at registration time.

export async function generateConversationKey(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_secretbox_keygen();
}

// Seal the CK to a device's X25519 public key. The output bytes are the wrap
// that gets uploaded to the server (one per recipient device).
export async function wrapConversationKey(
  conversationKey: Uint8Array,
  recipientEncryptionPublicKey: Uint8Array,
): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_box_seal(conversationKey, recipientEncryptionPublicKey);
}

// Open a wrap addressed to our own device. Requires both halves of the
// device encryption keypair (sealed-box opens use both the public and
// private key on the recipient side).
export async function unwrapConversationKey(
  wrappedKey: Uint8Array,
  ownEncryptionPublicKey: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
): Promise<Uint8Array | null> {
  const s = await getSodium();
  try {
    return s.crypto_box_seal_open(wrappedKey, ownEncryptionPublicKey, ownEncryptionPrivateKey);
  } catch {
    return null;
  }
}

export async function fromBase64(b64: string): Promise<Uint8Array> {
  const s = await getSodium();
  return s.from_base64(b64, s.base64_variants.ORIGINAL);
}

export async function toBase64(bytes: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}
