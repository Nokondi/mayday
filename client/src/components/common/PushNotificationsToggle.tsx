import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { updateUserSettings } from '../../api/users.js';
import { isPushSupported } from '../../utils/push.js';
import {
  PushError,
  enablePush,
  disablePush,
  translatePushError,
} from '../../utils/pushFlow.js';
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

export function PushNotificationsToggle({
  initialEnabled,
}: PushNotificationsToggleProps) {
  const intl = useIntl();
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
        ? intl.formatMessage({
            id: 'common.pushNotificationsToggle.enabledToast',
            defaultMessage: 'Push notifications enabled',
          })
        : intl.formatMessage({
            id: 'common.pushNotificationsToggle.disabledToast',
            defaultMessage: 'Push notifications disabled',
          }),
    errorMessage: (err) => {
      if (err instanceof PushError) return translatePushError(intl, err.code);
      if (err instanceof Error) return err.message;
      return intl.formatMessage({
        id: 'common.pushNotificationsToggle.updateFailedFallback',
        defaultMessage: 'Failed to update push notifications',
      });
    },
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
    helper = intl.formatMessage({
      id: 'common.pushNotificationsToggle.unsupportedHelper',
      defaultMessage: "Your browser doesn't support push notifications.",
    });
  } else if (denied) {
    helper = intl.formatMessage({
      id: 'common.pushNotificationsToggle.deniedHelper',
      defaultMessage:
        'Notifications are blocked in your browser. Re-enable them in your browser site settings to use this.',
    });
  } else {
    helper = intl.formatMessage({
      id: 'common.pushNotificationsToggle.defaultHelper',
      defaultMessage:
        "Get notified about activity even when Mayday isn't open in a tab.",
    });
  }

  const heading = intl.formatMessage({
    id: 'common.pushNotificationsToggle.heading',
    defaultMessage: 'Push notifications',
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{heading}</h3>
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
          className="mt-1 w-4 h-4 text-mayday-600 border-mayday-300 rounded focus:ring-mayday-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{heading}</div>
          <div className="text-xs text-gray-500 mt-0.5">{helper}</div>
        </div>
        {mutation.isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
        )}
      </label>
    </div>
  );
}
