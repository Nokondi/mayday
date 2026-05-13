import { getSodium } from './sodium.js';

// One device = one browser/install of the app. The device holds two keypairs:
//   - signing (Ed25519): identity. The public half goes in the user's device
//     list and produces the fingerprint shown in the UI. Reserved for X3DH
//     prekey signing if we ever upgrade to forward secrecy (Level B).
//   - encryption (X25519): peers seal the conversation key to this key.
// The private halves never leave this browser. We persist them in IndexedDB
// in a single record so a refresh keeps the same identity.

const DB_NAME = 'mayday-crypto';
const STORE_NAME = 'device';
const RECORD_KEY = 'self';

export interface DeviceKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface DeviceKeys {
  // Stable ID assigned by the server on first registration. Null on a freshly
  // generated, not-yet-registered device.
  serverId: string | null;
  signing: DeviceKeyPair;
  encryption: DeviceKeyPair;
  // Ed25519 signature over the X25519 public key, proving the same device
  // owns both. Computed at generation time, sent on register.
  encryptionKeySig: Uint8Array;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readRecord(): Promise<DeviceKeys | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = () => resolve((req.result as DeviceKeys | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function writeRecord(record: DeviceKeys): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

async function generateKeys(): Promise<DeviceKeys> {
  const s = await getSodium();
  const signing = s.crypto_sign_keypair();
  const encryption = s.crypto_box_keypair();
  // Sign the raw X25519 public key with the Ed25519 secret key. The server
  // accepts this on register; peers will verify it before encrypting to us
  // once that check is wired in Phase 2.
  const encryptionKeySig = s.crypto_sign_detached(encryption.publicKey, signing.privateKey);
  return {
    serverId: null,
    signing: { publicKey: signing.publicKey, privateKey: signing.privateKey },
    encryption: { publicKey: encryption.publicKey, privateKey: encryption.privateKey },
    encryptionKeySig,
    createdAt: Date.now(),
  };
}

// Load the device keys for this browser, generating + persisting them on the
// first call. Idempotent and safe to call from multiple places.
export async function loadOrCreateDevice(): Promise<DeviceKeys> {
  const existing = await readRecord();
  if (existing) return existing;
  const fresh = await generateKeys();
  await writeRecord(fresh);
  return fresh;
}

export async function saveServerId(serverId: string): Promise<void> {
  const existing = await readRecord();
  if (!existing) throw new Error('No device keys to attach server ID to');
  await writeRecord({ ...existing, serverId });
}

// Hard reset — wipes the local device record. Used when the server has
// revoked this device and the client should re-enroll as a fresh device.
export async function wipeDevice(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function toBase64(bytes: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_base64(bytes, s.base64_variants.ORIGINAL);
}
