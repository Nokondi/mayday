import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.js';
import { loadOrCreateDevice, saveServerId, toBase64, wipeDevice, type DeviceKeys } from '../crypto/device.js';
import { registerDevice } from '../api/devices.js';

interface DeviceContextType {
  device: DeviceKeys | null;
  // Null while still bootstrapping or if the user isn't logged in. The
  // settings UI uses this to render fingerprint and to flag the current
  // device in the list.
  serverId: string | null;
  error: Error | null;
}

const DeviceContext = createContext<DeviceContextType | null>(null);

// Bootstraps the device identity once per login. The flow:
//   1. Load (or generate) the device keypair from IndexedDB
//   2. If the keypair has no server ID yet, POST /devices to register it
//   3. If the server says the device is gone (e.g. revoked from another
//      session), wipe local storage and start over with a fresh identity
// This runs unconditionally as soon as a user is authenticated — Phase 1
// soaks the device registry in production so Phase 4's encryption flip
// has a populated device list to work with.
export function DeviceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [device, setDevice] = useState<DeviceKeys | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setDevice(null);
      setServerId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let keys = await loadOrCreateDevice();
        if (!keys.serverId) {
          const registered = await registerDevice({
            signingPublicKey: await toBase64(keys.signing.publicKey),
            encryptionPublicKey: await toBase64(keys.encryption.publicKey),
            encryptionKeySig: await toBase64(keys.encryptionKeySig),
            label: navigator.userAgent.slice(0, 120),
          });
          await saveServerId(registered.id);
          keys = { ...keys, serverId: registered.id };
        }
        if (cancelled) return;
        setDevice(keys);
        setServerId(keys.serverId);
      } catch (err) {
        if (cancelled) return;
        // If the device was deleted/revoked server-side, the next POST might
        // succeed but reads from /me would no longer include it. We don't
        // attempt auto-recovery here — Phase 5 will own the revoke UX. For
        // now, surface the error and leave the local record alone so the
        // user can re-try via Settings.
        // We *do* wipe if it's a 401 — that means the auth handshake
        // rotated under us; force a fresh device on next login.
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          await wipeDevice().catch(() => {});
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return (
    <DeviceContext.Provider value={{ device, serverId, error }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}
