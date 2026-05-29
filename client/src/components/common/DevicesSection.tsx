import { useEffect, useState } from 'react';
import { Loader2, LogOut, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedMessage, useIntl } from 'react-intl';
import type { Device } from '@mayday/shared';
import { getMyDevices, revokeDevice } from '../../api/devices.js';
import { fingerprintFromBase64 } from '../../crypto/fingerprint.js';
import { rotateConversationKeysAfterRevoke } from '../../crypto/rotate.js';
import { useDevice } from '../../context/DeviceContext.js';

interface DeviceWithFingerprint extends Device {
  fingerprint: string;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DevicesSection() {
  const intl = useIntl();
  const { device, serverId: currentDeviceId, capReached } = useDevice();
  const [devices, setDevices] = useState<DeviceWithFingerprint[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const reload = async () => {
    try {
      const list = await getMyDevices();
      const enriched = await Promise.all(
        list.map(async (d) => ({ ...d, fingerprint: await fingerprintFromBase64(d.signingPublicKey) })),
      );
      setDevices(enriched);
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'common.devicesSection.loadFailedToast',
          defaultMessage: 'Failed to load devices',
        }),
      );
    }
  };

  useEffect(() => { void reload(); }, []);

  // Revoke a single device. The actual API call is fast; the bulk of the
  // wall-clock time is the CK rotation that follows, which is what stops the
  // revoked device from being able to decrypt any *future* messages in the
  // conversations it participated in.
  const handleRevoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeDevice(id);
      if (device && currentDeviceId) {
        await rotateConversationKeysAfterRevoke({
          ownDevice: device,
          ownDeviceServerId: currentDeviceId,
          revokedDeviceIds: new Set([id]),
        });
      }
      toast.success(
        intl.formatMessage({
          id: 'common.devicesSection.revokeSuccessToast',
          defaultMessage: 'Device revoked',
        }),
      );
      await reload();
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'common.devicesSection.revokeFailedToast',
          defaultMessage: 'Failed to revoke device',
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  // Revoke every device except the one the user is currently on, then rotate
  // CKs once with all of them excluded. Doing the rotation as a batch (rather
  // than N times) means each conversation only generates one new CK no matter
  // how many devices the user is signing out.
  const handleSignOutOthers = async () => {
    if (!devices || !device || !currentDeviceId) return;
    const others = devices.filter((d) => !d.revokedAt && d.id !== currentDeviceId);
    if (others.length === 0) return;

    setBulkBusy(true);
    try {
      // Revoke in parallel — each call is independent.
      const results = await Promise.allSettled(others.map((d) => revokeDevice(d.id)));
      const succeeded = others.filter((_, i) => results[i]?.status === 'fulfilled');
      if (succeeded.length === 0) throw new Error('All revokes failed');

      await rotateConversationKeysAfterRevoke({
        ownDevice: device,
        ownDeviceServerId: currentDeviceId,
        revokedDeviceIds: new Set(succeeded.map((d) => d.id)),
      });

      toast.success(
        intl.formatMessage(
          {
            id: 'common.devicesSection.signOutOthersSuccessToast',
            defaultMessage: '{count, plural, one {# device} other {# devices}} signed out',
          },
          { count: succeeded.length },
        ),
      );
      await reload();
    } catch {
      toast.error(
        intl.formatMessage({
          id: 'common.devicesSection.signOutOthersFailedToast',
          defaultMessage: 'Failed to sign out other devices',
        }),
      );
    } finally {
      setBulkBusy(false);
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
  const otherActive = active.filter((d) => d.id !== currentDeviceId);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        <FormattedMessage
          id="common.devicesSection.heading"
          defaultMessage="Encryption devices"
        />
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        <FormattedMessage
          id="common.devicesSection.description"
          defaultMessage="Each browser you sign in from registers a device key used for end-to-end encryption. Compare fingerprints with the people you message to verify their identity."
        />
      </p>
      {capReached && (
        // The cap-reached banner explains why this device couldn't enrol and
        // points the user at the action they need to take (revoke an existing
        // device). DeviceContext sets capReached when POST /devices returns
        // 409 during boot — the local keypair stays, so once a slot frees up
        // the user can retry registration without losing their identity.
        <div
          role="alert"
          className="text-xs bg-red-50 border border-red-200 text-red-800 rounded p-2 mb-3"
        >
          <FormattedMessage
            id="common.devicesSection.capReachedBanner"
            defaultMessage="You've reached the device limit. Revoke an existing device below, then sign in again here to register this one."
          />
        </div>
      )}
      <ul className="space-y-2">
        {active.map((d) => {
          const isCurrent = d.id === currentDeviceId;
          const labelOrFallback =
            d.label ||
            intl.formatMessage({
              id: 'common.devicesSection.unnamedDevice',
              defaultMessage: 'Unnamed device',
            });
          return (
            <li
              key={d.id}
              className="flex items-start gap-3 p-3 border border-mayday-200 rounded-lg"
            >
              <Smartphone className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {labelOrFallback}
                  </span>
                  {isCurrent && (
                    <span className="text-xs bg-mayday-100 text-mayday-700 px-1.5 py-0.5 rounded">
                      <FormattedMessage
                        id="common.devicesSection.thisDeviceBadge"
                        defaultMessage="This device"
                      />
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono">{d.fingerprint}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  <FormattedMessage
                    id="common.devicesSection.addedDate"
                    defaultMessage="Added {date}"
                    values={{ date: formatRelative(d.createdAt) }}
                  />
                </div>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => handleRevoke(d.id)}
                  disabled={busyId === d.id || bulkBusy}
                  aria-label={intl.formatMessage(
                    {
                      id: 'common.devicesSection.revokeAriaLabel',
                      defaultMessage: 'Revoke {label}',
                    },
                    {
                      label:
                        d.label ||
                        intl.formatMessage({
                          id: 'common.devicesSection.revokeAriaFallbackLabel',
                          defaultMessage: 'device',
                        }),
                    },
                  )}
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
          <li className="text-sm text-gray-500 italic">
            <FormattedMessage
              id="common.devicesSection.noActiveDevicesEmpty"
              defaultMessage="No active devices"
            />
          </li>
        )}
      </ul>

      {otherActive.length > 0 && (
        <button
          type="button"
          onClick={handleSignOutOthers}
          disabled={bulkBusy || !!busyId}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-700 hover:text-red-800 disabled:opacity-50"
        >
          {bulkBusy
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <LogOut className="w-3.5 h-3.5" />}
          <FormattedMessage
            id="common.devicesSection.signOutOthersButton"
            defaultMessage="Sign out all other devices"
          />
        </button>
      )}
    </div>
  );
}
