import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/api/users.js', () => ({
  updateUserSettings: vi.fn(),
}));

vi.mock('../../../src/api/push.js', () => ({
  getPushPublicKey: vi.fn(),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
}));

vi.mock('../../../src/utils/push.js', () => ({
  isPushSupported: vi.fn(),
  registerServiceWorker: vi.fn(),
  getCurrentSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
}));

import { toast } from 'sonner';
import { updateUserSettings } from '../../../src/api/users.js';
import {
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
} from '../../../src/api/push.js';
import {
  isPushSupported,
  registerServiceWorker,
  getCurrentSubscription,
  subscribeToPush,
} from '../../../src/utils/push.js';
import { PushNotificationsToggle } from '../../../src/components/common/PushNotificationsToggle.js';

const mockedToast = vi.mocked(toast, true);
const mockedUpdate = vi.mocked(updateUserSettings);
const mockedGetKey = vi.mocked(getPushPublicKey);
const mockedSubscribePush = vi.mocked(subscribePush);
const mockedUnsubscribePush = vi.mocked(unsubscribePush);
const mockedIsSupported = vi.mocked(isPushSupported);
const mockedRegisterSW = vi.mocked(registerServiceWorker);
const mockedGetCurrentSub = vi.mocked(getCurrentSubscription);
const mockedSubscribeToPush = vi.mocked(subscribeToPush);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </IntlProvider>
  );
}

interface NotificationStub {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
}

function stubNotification(stub: NotificationStub) {
  // jsdom doesn't ship the Notification API, so we install a minimal stub
  // that's good enough for the component's permission / requestPermission reads.
  Object.defineProperty(globalThis, 'Notification', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

function stubServiceWorker(getRegistration: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { getRegistration },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults: supported browser, granted permission, no current sub.
  mockedIsSupported.mockReturnValue(true);
  stubNotification({
    permission: 'granted',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
  mockedGetCurrentSub.mockResolvedValue(null);
  mockedRegisterSW.mockResolvedValue({} as ServiceWorkerRegistration);
  mockedGetKey.mockResolvedValue('VAPID_PUBLIC_KEY_BASE64');
  mockedSubscribeToPush.mockResolvedValue({
    endpoint: 'https://fcm.example.com/abc',
    toJSON: () => ({
      endpoint: 'https://fcm.example.com/abc',
      keys: { p256dh: 'p', auth: 'a' },
    }),
  } as unknown as PushSubscription);
  mockedSubscribePush.mockResolvedValue();
  mockedUnsubscribePush.mockResolvedValue();
  mockedUpdate.mockImplementation(async ({ pushNotificationsEnabled }) => ({
    id: 'user-1',
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: pushNotificationsEnabled ?? false,
    notifyFriendPosts: true,
    minPostNotificationUrgency: 'LOW',
  }));
});

afterEach(() => {
  // Remove the stubbed Notification so it doesn't leak between tests.
  Object.defineProperty(globalThis, 'Notification', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('PushNotificationsToggle — rendering by browser state', () => {
  it('disables the checkbox and explains when push is unsupported', () => {
    mockedIsSupported.mockReturnValue(false);
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(
      screen.getByText(/browser doesn't support push notifications/i),
    ).toBeInTheDocument();
  });

  it('disables the checkbox and explains when permission is denied', () => {
    stubNotification({
      permission: 'denied',
      requestPermission: vi.fn(),
    });
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    expect(
      screen.getByText(/notifications are blocked in your browser/i),
    ).toBeInTheDocument();
  });

  it('forces the checkbox visually off when blocked, even if the saved pref says enabled', () => {
    stubNotification({
      permission: 'denied',
      requestPermission: vi.fn(),
    });
    render(<PushNotificationsToggle initialEnabled={true} />, { wrapper });

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reflects the saved pref when permission is granted', () => {
    render(<PushNotificationsToggle initialEnabled={true} />, { wrapper });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('PushNotificationsToggle — enabling push', () => {
  it('full happy path: register SW → fetch key → subscribe → POST sub → save pref', async () => {
    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith({ pushNotificationsEnabled: true });
    });

    expect(mockedRegisterSW).toHaveBeenCalled();
    expect(mockedGetKey).toHaveBeenCalled();
    expect(mockedSubscribeToPush).toHaveBeenCalledWith(
      expect.anything(),
      'VAPID_PUBLIC_KEY_BASE64',
    );
    expect(mockedSubscribePush).toHaveBeenCalled();
    expect(mockedToast.success).toHaveBeenCalledWith('Push notifications enabled');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('reuses an existing browser subscription instead of creating a new one', async () => {
    const existing = {
      endpoint: 'https://fcm.example.com/existing',
      toJSON: () => ({
        endpoint: 'https://fcm.example.com/existing',
        keys: { p256dh: 'p', auth: 'a' },
      }),
    } as unknown as PushSubscription;
    mockedGetCurrentSub.mockResolvedValue(existing);

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedSubscribePush).toHaveBeenCalledWith(existing);
    });
    expect(mockedSubscribeToPush).not.toHaveBeenCalled();
  });

  it('requests permission when permission is "default"', async () => {
    const stub: NotificationStub = {
      permission: 'default',
      requestPermission: vi.fn(),
    };
    // Real browsers mutate Notification.permission as a side effect of
    // requestPermission resolving — mirror that so the post-prompt check passes.
    stub.requestPermission.mockImplementation(async () => {
      stub.permission = 'granted';
      return 'granted';
    });
    stubNotification(stub);

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(stub.requestPermission).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockedSubscribePush).toHaveBeenCalled();
    });
  });

  it('reverts the toggle and toasts an error when the user denies the permission prompt', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied');
    stubNotification({ permission: 'default', requestPermission });

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/denied notification permission/i),
      );
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedSubscribeToPush).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reverts and toasts when the server has no VAPID key configured', async () => {
    mockedGetKey.mockResolvedValue(null);

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/not configured on the server/i),
      );
    });
    expect(mockedSubscribeToPush).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('reverts and toasts when registering the service worker fails', async () => {
    mockedRegisterSW.mockRejectedValue(new Error('SW registration blocked'));

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('SW registration blocked');
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

describe('PushNotificationsToggle — disabling push', () => {
  it('unsubscribes server-side and browser-side, then saves pref=false', async () => {
    const browserSub = {
      endpoint: 'https://fcm.example.com/abc',
      unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const reg = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(browserSub) },
    };
    stubServiceWorker(vi.fn().mockResolvedValue(reg));

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={true} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith({ pushNotificationsEnabled: false });
    });
    expect(mockedUnsubscribePush).toHaveBeenCalledWith(
      'https://fcm.example.com/abc',
    );
    expect(browserSub.unsubscribe).toHaveBeenCalled();
    expect(mockedToast.success).toHaveBeenCalledWith('Push notifications disabled');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('still saves pref=false when there is no SW registration to unsubscribe', async () => {
    stubServiceWorker(vi.fn().mockResolvedValue(undefined));

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={true} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith({ pushNotificationsEnabled: false });
    });
    expect(mockedUnsubscribePush).not.toHaveBeenCalled();
  });

  it('reverts the toggle when the server unsubscribe call fails', async () => {
    const browserSub = {
      endpoint: 'https://fcm.example.com/abc',
      unsubscribe: vi.fn(),
    };
    const reg = {
      pushManager: { getSubscription: vi.fn().mockResolvedValue(browserSub) },
    };
    stubServiceWorker(vi.fn().mockResolvedValue(reg));
    mockedUnsubscribePush.mockRejectedValue(new Error('network down'));

    const user = userEvent.setup();
    render(<PushNotificationsToggle initialEnabled={true} />, { wrapper });

    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('network down');
    });
    expect(browserSub.unsubscribe).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('PushNotificationsToggle — permission re-checks', () => {
  it('refreshes the disabled state when the page regains focus', async () => {
    // Start as supported + default permission so the toggle is enabled.
    stubNotification({
      permission: 'default',
      requestPermission: vi.fn(),
    });
    render(<PushNotificationsToggle initialEnabled={false} />, { wrapper });
    expect(screen.getByRole('checkbox')).not.toBeDisabled();

    // User flips browser site setting to "block" in another tab and comes back.
    stubNotification({
      permission: 'denied',
      requestPermission: vi.fn(),
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });
});
