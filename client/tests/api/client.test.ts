import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, getAccessToken, setAccessToken } from '../../src/api/client.js';

/**
 * The api instance's adapter is replaced in each test so that no real HTTP
 * traffic occurs. Interceptors still run, so assertions about the request
 * config we capture (and about how the response interceptor reacts to errors
 * we synthesize) exercise the real interceptor logic in client.ts.
 */
const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('client — access token storage', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it('starts out with no token', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and returns a token via setAccessToken/getAccessToken', () => {
    setAccessToken('abc123');
    expect(getAccessToken()).toBe('abc123');
  });

  it('clears the token when null is passed', () => {
    setAccessToken('abc123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('client — request interceptor', () => {
  it('is configured with baseURL "/api" and credentials', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('attaches the Authorization header when a token is set', async () => {
    setAccessToken('my-token');
    let capturedAuth: unknown;
    const adapter: AxiosAdapter = async (config) => {
      capturedAuth = config.headers?.Authorization;
      return {
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;

    await api.get('/anything');

    expect(capturedAuth).toBe('Bearer my-token');
  });

  it('does not attach an Authorization header when no token is set', async () => {
    let capturedAuth: unknown;
    const adapter: AxiosAdapter = async (config) => {
      capturedAuth = config.headers?.Authorization;
      return {
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;

    await api.get('/anything');

    expect(capturedAuth).toBeUndefined();
  });
});

describe('client — response interceptor (401 refresh flow)', () => {
  it('refreshes the access token on 401 and retries the original request', async () => {
    const postSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { accessToken: 'fresh-token' } });

    let callCount = 0;
    const adapter: AxiosAdapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject({
          response: { status: 401 },
          config,
        });
      }
      return {
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;

    const res = await api.get('/protected');

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/api/auth/refresh', {}, { withCredentials: true });
    expect(callCount).toBe(2);
    expect(res.data).toBe('ok');
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('attaches the newly refreshed token to the retried request', async () => {
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { accessToken: 'fresh-token' },
    });

    let callCount = 0;
    let retryAuth: unknown;
    const adapter: AxiosAdapter = async (config) => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject({
          response: { status: 401 },
          config,
        });
      }
      retryAuth = config.headers?.Authorization;
      return {
        data: 'ok',
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };
    api.defaults.adapter = adapter;

    await api.get('/protected');

    expect(retryAuth).toBe('Bearer fresh-token');
  });

  it('does not attempt refresh for /auth/ endpoints and rejects to the caller', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const adapter: AxiosAdapter = async (config) =>
      Promise.reject({ response: { status: 401 }, config });
    api.defaults.adapter = adapter;

    await expect(api.get('/auth/me')).rejects.toBeDefined();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('clears the access token and rejects when the refresh call itself fails', async () => {
    setAccessToken('stale-token');
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('refresh failed'));

    const adapter: AxiosAdapter = async (config) =>
      Promise.reject({ response: { status: 401 }, config });
    api.defaults.adapter = adapter;

    await expect(api.get('/protected')).rejects.toBeDefined();
    expect(getAccessToken()).toBeNull();
  });

  it('does not attempt a second refresh if the retried request also 401s', async () => {
    const postSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { accessToken: 'fresh-token' } });

    const adapter: AxiosAdapter = async (config) =>
      Promise.reject({ response: { status: 401 }, config });
    api.defaults.adapter = adapter;

    await expect(api.get('/protected')).rejects.toBeDefined();
    // Only the first 401 should have triggered a refresh attempt; the retry's
    // 401 must not trigger another one thanks to the _retry guard.
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('passes through non-401 errors without attempting refresh', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const adapter: AxiosAdapter = async (config) =>
      Promise.reject({ response: { status: 500 }, config });
    api.defaults.adapter = adapter;

    await expect(api.get('/anything')).rejects.toBeDefined();
    expect(postSpy).not.toHaveBeenCalled();
  });
});
