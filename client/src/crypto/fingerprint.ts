import { getSodium } from './sodium.js';

// Short human-verifiable identifier for a device. We hash the signing public
// key with Blake2b (libsodium's general-purpose hash) and render the first 8
// hex chars grouped 4-4. Users can compare this out-of-band ("read me the
// fingerprint shown on your phone") to verify they're talking to who they think.
//
// Why hash instead of showing the key directly? Public keys are 64 hex chars;
// a fingerprint is short enough to read over the phone, and a collision attack
// on the first 32 bits costs ~4B operations — fine for opportunistic verify.
export async function shortFingerprint(signingPublicKey: Uint8Array): Promise<string> {
  const s = await getSodium();
  const digest = s.crypto_generichash(32, signingPublicKey);
  const hex = s.to_hex(digest).slice(0, 8);
  return `${hex.slice(0, 4)} ${hex.slice(4, 8)}`;
}

export async function fingerprintFromBase64(b64SigningPublicKey: string): Promise<string> {
  const s = await getSodium();
  const bytes = s.from_base64(b64SigningPublicKey, s.base64_variants.ORIGINAL);
  return shortFingerprint(bytes);
}
