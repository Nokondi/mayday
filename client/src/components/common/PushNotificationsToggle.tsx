import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { updateUserSettings } from '../../api/users.js';
import {
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
} from '../../api/push.js';
import {
  isPushSupported,
  registerServiceWorker,
  getCurrentSubscription,
  subscribeToPush,
} from '../../utils/push.js';
import { useToastMutation } from '../../hooks/useToastMutation.js';

interface PushNotificationsToggleProps {
  initialEnabled: boolean;
}

type BrowserState =
  | { kind: 'unsupported' }
  | { kind: 'permission'; permission: NotificationPermission };

function readBrowserState(): BrowserState {
  if (!isPushSupported()) return { kind: 'unsupported' };
  return { kind: 'permission', permission: Notification.permission };
}

async function enablePush(): Promise<void> {
  // Permission must be requested from a user gesture; this whole flow is
  // triggered from the toggle's change handler, which qualifies.
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      throw new Error(
        result === 'denied'
          ? 'You denied notification permission. Re-enable it in your browser site settings.'
          : 'Notification permission was not granted.',
      );
    }
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Notifications are blocked in your browser.');
  }

  const reg = await registerServiceWorker();
  const publicKey = await getPushPublicKey();
  if (!publicKey) {
    throw new Error('Push notifications are not configured on the server.');
  }

  const existing = await getCurrentSubscription(reg);
  const sub = existing ?? (await subscribeToPush(reg, publicKey));
  await subscribePush(sub);
}

async function disablePush(): Promise<void> {
  // Unsubscribe server-side first so a half-failed turn-off doesn't leave the
  // browser quiet while the server still thinks we want pushes.
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await unsubscribePush(sub.endpoint);
  await sub.unsubscribe();
}

export function PushNotificationsToggle({
  initialEnabled,
}: PushNotificationsToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [browser, setBrowser] = useState<BrowserState>(() => readBrowserState());

  // Permission state can change while the modal is open (user changes site
  // settings in another tab, or the requestPermission() prompt resolves).
  // Re-read it whenever the page regains focus.
  useEffect(() => {
    const refresh = () => setBrowser(readBrowserState());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const mutation = useToastMutation({
    mutationFn: async (next: boolean) => {
      if (next) await enablePush();
      else await disablePush();
      // Always read the post-flow permission so the UI reflects what the user
      // actually granted (e.g. they may have closed the prompt).
      setBrowser(readBrowserState());
      const result = await updateUserSettings({
        pushNotificationsEnabled: next,
      });
      return result;
    },
    successMessage: (data) =>
      data.pushNotificationsEnabled
        ? 'Push notifications enabled'
        : 'Push notifications disabled',
    errorMessage: (err) =>
      err instanceof Error ? err.message : 'Failed to update push notifications',
    onSuccess: (data) => {
      setEnabled(data.pushNotificationsEnabled);
    },
    onError: (_err, attempted) => {
      setEnabled(!attempted);
    },
  });

  const unsupported = browser.kind === 'unsupported';
  const denied =
    browser.kind === 'permission' && browser.permission === 'denied';
  const disabled = unsupported || denied || mutation.isPending;
  // If the browser blocked it, force the visual state to off — the pref stored
  // server-side may still say true, but no pushes can possibly be delivered.
  const checked = enabled && !unsupported && !denied;

  let helper: string;
  if (unsupported) {
    helper = "Your browser doesn't support push notifications.";
  } else if (denied) {
    helper =
      'Notifications are blocked in your browser. Re-enable them in your browser site settings to use this.';
  } else {
    helper =
      "Get notified about activity even when Mayday isn't open in a tab.";
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Push notifications
      </h3>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const next = e.target.checked;
            setEnabled(next);
            mutation.mutate(next);
          }}
          disabled={disabled}
          className="mt-1 w-4 h-4 text-mayday-600 border-gray-300 rounded focus:ring-mayday-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            Push notifications
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{helper}</div>
        </div>
        {mutation.isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
        )}
      </label>
    </div>
  );
}
