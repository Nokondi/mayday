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
  // True when registration failed because the user is at their per-account
  // active-device cap (server returns 409). DevicesSection surfaces this so
  // the user knows to revoke an existing device to free a slot.
  capReached: boolean;
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
  const [capReached, setCapReached] = useState(false);

  useEffect(() => {
    if (!user) {
      setDevice(null);
      setServerId(null);
      setCapReached(false);
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
        // 401 = auth rotated under us; wipe local keys and let the user
        // re-enroll on next login.
        // 409 = device cap reached; flag it so the settings UI prompts the
        // user to revoke an existing device. The local keypair stays — when
        // a slot opens up, the same keys can register without regenerating.
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            await wipeDevice().catch(() => {});
          } else if (err.response?.status === 409) {
            setCapReached(true);
          }
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return (
    <DeviceContext.Provider value={{ device, serverId, error, capReached }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}
