import { useEffect } from 'react';
import { toast } from 'sonner';
import { useIntl } from 'react-intl';
import { useAuth } from '../../context/AuthContext.js';
import { updateUserSettings } from '../../api/users.js';
import { isPushSupported } from '../../utils/push.js';
import {
  PushError,
  enablePush,
  ensurePushSubscription,
  translatePushError,
} from '../../utils/pushFlow.js';

// One-shot flag: the install prompt is shown at most once per browser.
const INSTALL_PROMPT_SHOWN_KEY = 'mayday:push-install-prompt-shown';

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag for home-screen launches.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Invisible boot-time component (mounted once in App) that keeps push
 * working without user action:
 *
 * 1. Silent repair — when a logged-in user already granted notification
 *    permission and hasn't turned pushes off, make sure a live subscription
 *    exists and is registered server-side. Covers fresh PWA installs where
 *    permission carried over, subscriptions the push service dropped, and
 *    re-linking the device after switching accounts.
 * 2. Install prompt — when the app is installed (appinstalled event) or first
 *    launched standalone and permission was never asked, offer a one-time
 *    toast whose button click (a user gesture, as requestPermission requires)
 *    runs the full enable flow.
 */
export function PushBootstrap() {
  const intl = useIntl();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pushPrefEnabled = user?.pushNotificationsEnabled !== false;

  useEffect(() => {
    if (!userId || !pushPrefEnabled) return;
    ensurePushSubscription().catch(() => {
      // Best effort — the settings toggle remains the manual path.
    });
  }, [userId, pushPrefEnabled]);

  useEffect(() => {
    if (!userId) return;

    const enableFromPrompt = async () => {
      try {
        await enablePush();
        await updateUserSettings({ pushNotificationsEnabled: true });
        toast.success(
          intl.formatMessage({
            id: 'common.pushBootstrap.enabledToast',
            defaultMessage: 'Push notifications enabled',
          }),
        );
      } catch (err) {
        toast.error(
          err instanceof PushError
            ? translatePushError(intl, err.code)
            : intl.formatMessage({
                id: 'common.pushBootstrap.enableFailedToast',
                defaultMessage: 'Failed to enable push notifications',
              }),
        );
      }
    };

    const maybePrompt = () => {
      if (!isPushSupported()) return;
      // Only when permission was never decided: 'granted' is handled by the
      // silent repair above, 'denied' is the user's call.
      if (Notification.permission !== 'default') return;
      if (localStorage.getItem(INSTALL_PROMPT_SHOWN_KEY)) return;
      localStorage.setItem(INSTALL_PROMPT_SHOWN_KEY, '1');

      toast(
        intl.formatMessage({
          id: 'common.pushBootstrap.installPromptMessage',
          defaultMessage: 'Turn on notifications to hear about new activity?',
        }),
        {
          id: 'push-install-prompt',
          duration: 15000,
          action: {
            label: intl.formatMessage({
              id: 'common.pushBootstrap.installPromptEnableButton',
              defaultMessage: 'Enable',
            }),
            onClick: () => {
              void enableFromPrompt();
            },
          },
        },
      );
    };

    // Already-installed launch (the appinstalled event only fires in the tab
    // that triggered the install).
    if (isStandaloneDisplay()) maybePrompt();

    const onInstalled = () => maybePrompt();
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, [userId, intl]);

  return null;
}
