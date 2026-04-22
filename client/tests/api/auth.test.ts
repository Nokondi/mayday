import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../src/api/client.js';
import { getMe, login, logout, register, resendVerification, verifyEmail } from '../../src/api/auth.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth api', () => {
  describe('register', () => {
    it('POSTs /auth/register with the provided data and returns the response body', async () => {
      const payload = { email: 'a@b.com', password: 'pw', name: 'A' } as never;
      const response = {
        message: 'Account created. Check your email to confirm your address before logging in.',
        user: { id: 'u1', email: 'a@b.com', name: 'A' },
      };
      mockedApi.post.mockResolvedValueOnce({ data: response });

      const result = await register(payload);

      expect(mockedApi.post).toHaveBeenCalledTimes(1);
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', payload);
      expect(result).toEqual(response);
    });
  });

  describe('login', () => {
    it('POSTs /auth/login with the provided data and returns the response body', async () => {
      const payload = { email: 'a@b.com', password: 'pw' } as never;
      const response = { user: { id: 'u1' }, accessToken: 'tok' };
      mockedApi.post.mockResolvedValueOnce({ data: response });

      const result = await login(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', payload);
      expect(result).toEqual(response);
    });
  });

  describe('logout', () => {
    it('POSTs /auth/logout with no body', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: undefined });

      await logout();

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('resolves to undefined', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { irrelevant: true } });
      await expect(logout()).resolves.toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('GETs /auth/me and returns the response body', async () => {
      const response = { id: 'u1', email: 'a@b.com' };
      mockedApi.get.mockResolvedValueOnce({ data: response });

      const result = await getMe();

      expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(response);
    });
  });

  describe('verifyEmail', () => {
    it('POSTs /auth/verify-email with the token in the body', async () => {
      const response = { message: 'Email verified. You can now log in.' };
      mockedApi.post.mockResolvedValueOnce({ data: response });

      const result = await verifyEmail('abc123');

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'abc123' });
      expect(result).toEqual(response);
    });
  });

  describe('resendVerification', () => {
    it('POSTs /auth/resend-verification with the email', async () => {
      const response = { message: 'If that account exists and is unverified, a new confirmation email has been sent.' };
      mockedApi.post.mockResolvedValueOnce({ data: response });

      const result = await resendVerification({ email: 'a@b.com' });

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'a@b.com' });
      expect(result).toEqual(response);
    });
  });
});
