import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/push.js', () => ({
  getPushPublicKey: vi.fn(),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
}));

vi.mock('../../src/utils/push.js', () => ({
  isPushSupported: vi.fn(),
  registerServiceWorker: vi.fn(),
  getCurrentSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
}));

import { getPushPublicKey, subscribePush } from '../../src/api/push.js';
import {
  isPushSupported,
  registerServiceWorker,
  getCurrentSubscription,
  subscribeToPush,
} from '../../src/utils/push.js';
import { ensurePushSubscription } from '../../src/utils/pushFlow.js';

const mockedIsSupported = vi.mocked(isPushSupported);
const mockedRegisterSW = vi.mocked(registerServiceWorker);
const mockedGetCurrentSub = vi.mocked(getCurrentSubscription);
const mockedSubscribeToPush = vi.mocked(subscribeToPush);
const mockedGetKey = vi.mocked(getPushPublicKey);
const mockedSubscribePush = vi.mocked(subscribePush);

function stubPermission(permission: NotificationPermission) {
  Object.defineProperty(globalThis, 'Notification', {
    value: { permission },
    configurable: true,
    writable: true,
  });
}

const FAKE_REG = {} as ServiceWorkerRegistration;
const FAKE_SUB = { endpoint: 'https://fcm.example.com/abc' } as PushSubscription;

beforeEach(() => {
  vi.clearAllMocks();
  mockedIsSupported.mockReturnValue(true);
  mockedRegisterSW.mockResolvedValue(FAKE_REG);
  mockedGetCurrentSub.mockResolvedValue(null);
  mockedGetKey.mockResolvedValue('VAPID_KEY');
  mockedSubscribeToPush.mockResolvedValue(FAKE_SUB);
  mockedSubscribePush.mockResolvedValue();
  stubPermission('granted');
});

afterEach(() => {
  Object.defineProperty(globalThis, 'Notification', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('ensurePushSubscription', () => {
  it('is a no-op when push is unsupported', async () => {
    mockedIsSupported.mockReturnValue(false);
    await ensurePushSubscription();
    expect(mockedRegisterSW).not.toHaveBeenCalled();
  });

  it('never prompts — a no-op unless permission is already granted', async () => {
    stubPermission('default');
    await ensurePushSubscription();
    expect(mockedRegisterSW).not.toHaveBeenCalled();
    expect(mockedSubscribePush).not.toHaveBeenCalled();
  });

  it('re-registers an existing browser subscription with the server', async () => {
    mockedGetCurrentSub.mockResolvedValue(FAKE_SUB);

    await ensurePushSubscription();

    expect(mockedSubscribePush).toHaveBeenCalledWith(FAKE_SUB);
    expect(mockedSubscribeToPush).not.toHaveBeenCalled();
  });

  it('creates and registers a new subscription when none exists', async () => {
    await ensurePushSubscription();

    expect(mockedSubscribeToPush).toHaveBeenCalledWith(FAKE_REG, 'VAPID_KEY');
    expect(mockedSubscribePush).toHaveBeenCalledWith(FAKE_SUB);
  });

  it('bails quietly when the server has no VAPID key configured', async () => {
    mockedGetKey.mockResolvedValue(null);

    await ensurePushSubscription();

    expect(mockedSubscribeToPush).not.toHaveBeenCalled();
    expect(mockedSubscribePush).not.toHaveBeenCalled();
  });
});
