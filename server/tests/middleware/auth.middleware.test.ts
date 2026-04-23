import type { NextFunction, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prisma before importing the middleware so rejectBanned uses the stub.
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  requireAdmin,
  requireAuth,
  rejectBanned,
  type AuthRequest,
} from '../../src/middleware/auth.middleware.js';
import { AppError } from '../../src/middleware/error.middleware.js';
import { signAccessToken, signRefreshToken } from '../../src/utils/jwt.js';

const mockedFindUnique = vi.mocked(prisma.user.findUnique);

function makeReq(headers: Record<string, string> = {}): AuthRequest {
  return { headers, user: undefined } as unknown as AuthRequest;
}

const res = {} as Response;
let next: NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
  next = vi.fn() as unknown as NextFunction;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requireAuth', () => {
  const payload = { id: 'u1', email: 'a@b.com', role: 'USER' };

  it('throws 401 when the Authorization header is missing', () => {
    const req = makeReq();
    expect(() => requireAuth(req, res, next)).toThrow(AppError);
    try {
      requireAuth(req, res, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).message).toMatch(/authentication required/i);
    }
  });

  it('throws 401 when the Authorization header is not a Bearer token', () => {
    const req = makeReq({ authorization: 'Basic abc' });
    expect(() => requireAuth(req, res, next)).toThrow(AppError);
  });

  it('throws 401 when the bearer token is invalid', () => {
    const req = makeReq({ authorization: 'Bearer not-a-valid-jwt' });
    expect(() => requireAuth(req, res, next)).toThrow(AppError);
    try {
      requireAuth(req, res, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).message).toMatch(/invalid or expired/i);
    }
  });

  it('throws 401 when a refresh token is used instead of an access token', () => {
    const req = makeReq({ authorization: `Bearer ${signRefreshToken(payload)}` });
    expect(() => requireAuth(req, res, next)).toThrow(AppError);
  });

  it('attaches the decoded payload to req.user and calls next() for a valid token', () => {
    const token = signAccessToken(payload);
    const req = makeReq({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(req.user).toMatchObject(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('does not call next() on failure', () => {
    const req = makeReq();
    expect(() => requireAuth(req, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('calls next() when the user has role ADMIN', () => {
    const req = { user: { id: 'a', email: 'a@b.com', role: 'ADMIN' } } as AuthRequest;
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('throws 403 when the user has a non-admin role', () => {
    const req = { user: { id: 'u', email: 'u@b.com', role: 'USER' } } as AuthRequest;
    expect(() => requireAdmin(req, res, next)).toThrow(AppError);
    try {
      requireAdmin(req, res, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).message).toMatch(/admin access required/i);
    }
  });

  it('throws 403 when req.user is not set (no auth)', () => {
    const req = {} as AuthRequest;
    expect(() => requireAdmin(req, res, next)).toThrow(AppError);
  });
});

describe('rejectBanned', () => {
  const user = { id: 'u1', email: 'a@b.com', role: 'USER' };

  it('passes through when the user is not banned', async () => {
    mockedFindUnique.mockResolvedValueOnce({ isBanned: false } as never);
    const req = { user } as AuthRequest;
    await rejectBanned(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { isBanned: true },
    });
  });

  it('passes next(AppError(403)) when the user is banned', async () => {
    mockedFindUnique.mockResolvedValueOnce({ isBanned: true } as never);
    const req = { user } as AuthRequest;
    await rejectBanned(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/suspended/i);
  });

  it('passes next(err) when the database lookup rejects', async () => {
    const dbErr = new Error('db down');
    mockedFindUnique.mockRejectedValueOnce(dbErr);
    const req = { user } as AuthRequest;
    await rejectBanned(req, res, next);
    expect(next).toHaveBeenCalledWith(dbErr);
  });

  it('passes next(AppError(401)) when the user record no longer exists', async () => {
    // Prevents FK-violation leaks for actions taken with a stale access token
    // whose user was deleted mid-session.
    mockedFindUnique.mockResolvedValueOnce(null as never);
    const req = { user } as AuthRequest;
    await rejectBanned(req, res, next);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toMatch(/no longer exists/i);
  });
});
