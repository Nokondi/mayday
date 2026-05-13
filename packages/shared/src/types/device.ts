// End-to-end encryption device types. A Device represents one browser/install
// of the app belonging to a user. Each device publishes two public keys: an
// Ed25519 identity/signing key and an X25519 encryption key signed by it.
// Private keys live only in the client's IndexedDB and never reach the server.

// Wire representation: keys are sent as base64. The server stores them as
// raw bytes (Postgres BYTEA), but JSON can't carry binary so all routes
// exchange base64-encoded strings.

export interface DevicePublicKeys {
  signingPublicKey: string;       // base64-encoded Ed25519 public key (32 bytes)
  encryptionPublicKey: string;    // base64-encoded X25519 public key (32 bytes)
  encryptionKeySig: string;       // base64-encoded Ed25519 signature
}

export interface Device extends DevicePublicKeys {
  id: string;
  userId: string;
  label: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

// What other users see when they look up a peer's devices to encrypt to —
// excludes lastSeenAt (no need to leak peer activity) and revoked devices.
export interface PeerDevice extends DevicePublicKeys {
  id: string;
  userId: string;
  createdAt: string;
}
