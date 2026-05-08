import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent the env module from loading values from the repo's real .env file.
vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }));

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

const findManyMock = vi.fn();
const deleteManyMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    pushSubscription: {
      findMany: findManyMock,
      deleteMany: deleteManyMock,
      updateMany: updateManyMock,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  for (const k of Object.keys(process.env)) delete process.env[k];
  process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/z';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.CLIENT_URL = 'https://mayday.test';
  process.env.NODE_ENV = 'test';
});

const PAYLOAD = {
  title: 'Hello',
  body: 'World',
  url: '/',
};

const SUB = {
  id: 'sub-1',
  endpoint: 'https://fcm.example.com/abc',
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
};

describe('isPushConfigured', () => {
  it('returns false when VAPID keys are absent', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    expect(isPushConfigured()).toBe(false);
    expect(setVapidDetailsMock).not.toHaveBeenCalled();
  });

  it('returns false when keys are set but no contact email is available', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    delete process.env.VAPID_CONTACT_EMAIL;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_USER;
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    expect(isPushConfigured()).toBe(false);
  });

  it('configures web-push with mailto: subject and returns true when keys + contact set', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_CONTACT_EMAIL = 'admin@mayday.test';
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    expect(isPushConfigured()).toBe(true);
    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      'mailto:admin@mayday.test',
      'pub',
      'priv',
    );
  });

  it('preserves an already-prefixed mailto: contact', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_CONTACT_EMAIL = 'mailto:admin@mayday.test';
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    isPushConfigured();
    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      'mailto:admin@mayday.test',
      'pub',
      'priv',
    );
  });

  it('configures web-push only once across many calls (lazy init)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_CONTACT_EMAIL = 'admin@mayday.test';
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    isPushConfigured();
    isPushConfigured();
    isPushConfigured();
    expect(setVapidDetailsMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to SMTP_FROM as the contact when VAPID_CONTACT_EMAIL is unset', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.SMTP_FROM = 'fallback@mayday.test';
    const { isPushConfigured } = await import('../../src/services/push.service.js');
    isPushConfigured();
    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      'mailto:fallback@mayday.test',
      'pub',
      'priv',
    );
  });
});

describe('sendPushToUser', () => {
  function configureEnv() {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_CONTACT_EMAIL = 'admin@mayday.test';
  }

  it('no-ops when push is not configured (no DB query, no send)', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('no-ops when the user has no subscriptions', async () => {
    configureEnv();
    findManyMock.mockResolvedValue([]);
    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('sends to every subscription with the JSON-stringified payload', async () => {
    configureEnv();
    const subB = { ...SUB, id: 'sub-2', endpoint: 'https://fcm.example.com/xyz' };
    findManyMock.mockResolvedValue([SUB, subB]);
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, keys: { p256dh: SUB.p256dh, auth: SUB.auth } },
      JSON.stringify(PAYLOAD),
    );
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: subB.endpoint, keys: { p256dh: subB.p256dh, auth: subB.auth } },
      JSON.stringify(PAYLOAD),
    );
  });

  it('bumps lastSuccessAt for every successful subscription', async () => {
    configureEnv();
    const subB = { ...SUB, id: 'sub-2', endpoint: 'https://fcm.example.com/xyz' };
    findManyMock.mockResolvedValue([SUB, subB]);
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(updateManyMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['sub-1', 'sub-2'] } },
      data: { lastSuccessAt: expect.any(Date) },
    });
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it('deletes subscriptions that return 410 Gone', async () => {
    configureEnv();
    findManyMock.mockResolvedValue([SUB]);
    sendNotificationMock.mockRejectedValue({ statusCode: 410 });

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: { in: ['sub-1'] } } });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('deletes subscriptions that return 404 Not Found', async () => {
    configureEnv();
    findManyMock.mockResolvedValue([SUB]);
    sendNotificationMock.mockRejectedValue({ statusCode: 404 });

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: { in: ['sub-1'] } } });
  });

  it('does not delete subscriptions on transient errors (e.g. 500)', async () => {
    configureEnv();
    findManyMock.mockResolvedValue([SUB]);
    sendNotificationMock.mockRejectedValue({ statusCode: 500 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('handles a mix of success, gone, and transient errors in one fan-out', async () => {
    configureEnv();
    const okSub = SUB;
    const goneSub = { ...SUB, id: 'sub-gone', endpoint: 'https://fcm.example.com/gone' };
    const flakySub = { ...SUB, id: 'sub-flaky', endpoint: 'https://fcm.example.com/flaky' };
    findManyMock.mockResolvedValue([okSub, goneSub, flakySub]);
    sendNotificationMock.mockImplementation(async (target: { endpoint: string }) => {
      if (target.endpoint === goneSub.endpoint) throw { statusCode: 410 };
      if (target.endpoint === flakySub.endpoint) throw { statusCode: 503 };
      return { statusCode: 201 };
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendPushToUser } = await import('../../src/services/push.service.js');
    await sendPushToUser('user-1', PAYLOAD);

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: { in: ['sub-gone'] } } });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['sub-1'] } },
      data: { lastSuccessAt: expect.any(Date) },
    });
    errSpy.mockRestore();
  });
});
