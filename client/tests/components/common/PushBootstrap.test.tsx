import { render, waitFor, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});

let currentUser: Record<string, unknown> | null = null;
vi.mock('../../../src/context/AuthContext.js', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('../../../src/api/users.js', () => ({
  updateUserSettings: vi.fn(),
}));

vi.mock('../../../src/utils/push.js', () => ({
  isPushSupported: vi.fn(),
}));

vi.mock('../../../src/utils/pushFlow.js', () => {
  class PushError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return {
    PushError,
    enablePush: vi.fn(),
    ensurePushSubscription: vi.fn(),
    translatePushError: vi.fn(() => 'translated push error'),
  };
});

import { toast } from 'sonner';
import { updateUserSettings } from '../../../src/api/users.js';
import { isPushSupported } from '../../../src/utils/push.js';
import { enablePush, ensurePushSubscription } from '../../../src/utils/pushFlow.js';
import { PushBootstrap } from '../../../src/components/common/PushBootstrap.js';

const mockedToast = vi.mocked(toast);
const mockedUpdateSettings = vi.mocked(updateUserSettings);
const mockedIsSupported = vi.mocked(isPushSupported);
const mockedEnablePush = vi.mocked(enablePush);
const mockedEnsure = vi.mocked(ensurePushSubscription);

const PROMPT_KEY = 'mayday:push-install-prompt-shown';

function stubPermission(permission: NotificationPermission) {
  Object.defineProperty(globalThis, 'Notification', {
    value: { permission },
    configurable: true,
    writable: true,
  });
}

function stubMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => ({ matches: standalone })),
    configurable: true,
    writable: true,
  });
}

function renderBootstrap() {
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <PushBootstrap />
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  currentUser = { id: 'u1', pushNotificationsEnabled: true };
  mockedIsSupported.mockReturnValue(true);
  mockedEnsure.mockResolvedValue(undefined);
  mockedEnablePush.mockResolvedValue(undefined);
  mockedUpdateSettings.mockResolvedValue({} as never);
  stubPermission('default');
  stubMatchMedia(false);
});

afterEach(() => {
  Object.defineProperty(globalThis, 'Notification', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('PushBootstrap — silent subscription repair', () => {
  it('ensures a subscription for a logged-in user with pushes on', async () => {
    renderBootstrap();
    await waitFor(() => expect(mockedEnsure).toHaveBeenCalledTimes(1));
  });

  it('does nothing when the user has turned pushes off', () => {
    currentUser = { id: 'u1', pushNotificationsEnabled: false };
    renderBootstrap();
    expect(mockedEnsure).not.toHaveBeenCalled();
  });

  it('does nothing when logged out', () => {
    currentUser = null;
    renderBootstrap();
    expect(mockedEnsure).not.toHaveBeenCalled();
  });
});

describe('PushBootstrap — enable-on-install prompt', () => {
  it('prompts once when the app is installed and permission was never asked', async () => {
    renderBootstrap();
    expect(mockedToast).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(mockedToast).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PROMPT_KEY)).toBe('1');

    // A second install event must not re-prompt.
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(mockedToast).toHaveBeenCalledTimes(1);
  });

  it('prompts on first standalone launch (already-installed PWA)', () => {
    stubMatchMedia(true);
    renderBootstrap();
    expect(mockedToast).toHaveBeenCalledTimes(1);
  });

  it('does not prompt when permission is already granted — silent repair handles it', () => {
    stubPermission('granted');
    stubMatchMedia(true);
    renderBootstrap();
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('does not prompt when permission was denied', () => {
    stubPermission('denied');
    stubMatchMedia(true);
    renderBootstrap();
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('does not prompt when it was already shown once', () => {
    localStorage.setItem(PROMPT_KEY, '1');
    stubMatchMedia(true);
    renderBootstrap();
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('clicking Enable runs the push flow and persists the preference', async () => {
    stubMatchMedia(true);
    renderBootstrap();

    const options = mockedToast.mock.calls[0]?.[1] as unknown as {
      action: { onClick: () => void };
    };
    act(() => {
      options.action.onClick();
    });

    await waitFor(() => expect(mockedEnablePush).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        pushNotificationsEnabled: true,
      }),
    );
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalled());
  });

  it('shows a translated error toast when enabling fails', async () => {
    stubMatchMedia(true);
    mockedEnablePush.mockRejectedValueOnce(new Error('boom'));
    renderBootstrap();

    const options = mockedToast.mock.calls[0]?.[1] as unknown as {
      action: { onClick: () => void };
    };
    act(() => {
      options.action.onClick();
    });

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalled());
    expect(mockedUpdateSettings).not.toHaveBeenCalled();
  });
});
