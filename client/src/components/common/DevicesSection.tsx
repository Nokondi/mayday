import { useEffect, useState } from 'react';
import { Loader2, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Device } from '@mayday/shared';
import { getMyDevices, revokeDevice } from '../../api/devices.js';
import { fingerprintFromBase64 } from '../../crypto/fingerprint.js';
import { useDevice } from '../../context/DeviceContext.js';

interface DeviceWithFingerprint extends Device {
  fingerprint: string;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DevicesSection() {
  const { serverId: currentDeviceId } = useDevice();
  const [devices, setDevices] = useState<DeviceWithFingerprint[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    try {
      const list = await getMyDevices();
      const enriched = await Promise.all(
        list.map(async (d) => ({ ...d, fingerprint: await fingerprintFromBase64(d.signingPublicKey) })),
      );
      setDevices(enriched);
    } catch {
      toast.error('Failed to load devices');
    }
  };

  useEffect(() => { void reload(); }, []);

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeDevice(id);
      toast.success('Device revoked');
      await reload();
    } catch {
      toast.error('Failed to revoke device');
    } finally {
      setBusyId(null);
    }
  };

  if (!devices) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  const active = devices.filter((d) => !d.revokedAt);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Encryption devices</h3>
      <p className="text-xs text-gray-500 mb-3">
        Each browser you sign in from registers a device key used for end-to-end encryption.
        Compare fingerprints with the people you message to verify their identity.
      </p>
      <ul className="space-y-2">
        {active.map((d) => {
          const isCurrent = d.id === currentDeviceId;
          return (
            <li
              key={d.id}
              className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
            >
              <Smartphone className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {d.label || 'Unnamed device'}
                  </span>
                  {isCurrent && (
                    <span className="text-xs bg-mayday-100 text-mayday-700 px-1.5 py-0.5 rounded">
                      This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono">{d.fingerprint}</div>
                <div className="text-xs text-gray-400 mt-0.5">Added {formatRelative(d.createdAt)}</div>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => handleRevoke(d.id)}
                  disabled={busyId === d.id}
                  aria-label={`Revoke ${d.label || 'device'}`}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  {busyId === d.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </li>
          );
        })}
        {active.length === 0 && (
          <li className="text-sm text-gray-500 italic">No active devices</li>
        )}
      </ul>
    </div>
  );
}
