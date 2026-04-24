import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock prisma before importing routes so the route handlers bind to the stub.
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the mail service so tests don't attempt real SMTP calls.
vi.mock('../../src/services/mail.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendRegistrationCollisionEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationCollisionEmail,
} from '../../src/services/mail.service.js';
import {
  signAccessToken,
  signRefreshToken,
  signVerificationToken,
  signPasswordResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyPasswordResetToken,
  passwordFingerprint,
} from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';

const mockedUser = vi.mocked(prisma.user);
const mockedSendVerificationEmail = vi.mocked(sendVerificationEmail);
const mockedSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);
const mockedSendRegistrationCollisionEmail = vi.mocked(sendRegistrationCollisionEmail);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorMiddleware);
  return app;
}

function dbUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    email: 'alice@example.com',
    name: 'Alice',
    passwordHash: 'placeholder',
    role: 'USER',
    isBanned: false,
    emailVerified: true,
    bio: null,
    location: null,
    latitude: null,
    longitude: null,
    skills: [] as string[],
    createdAt: new Date('2020-01-01T00:00:00Z'),
    updatedAt: new Date('2020-01-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/auth/register', () => {
  it('creates an unverified user and dispatches a verification email', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    mockedUser.create.mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => {
      return dbUser({
        email: data.email as string,
        name: data.name as string,
        emailVerified: false,
      }) as never;
    });

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'hunter2pw', name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/confirm/i);
    // The response deliberately excludes any user identifier — the success
    // and collision branches must be byte-identical so the endpoint can't
    // be used to enumerate accounts.
    expect(res.body.user).toBeUndefined();
    // Register does not issue tokens — login is blocked until verification.
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();

    // Verification tokens are stateless JWTs — nothing is stored on the user.
    const createArgs = mockedUser.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data).not.toHaveProperty('verificationToken');
    expect(createArgs.data).not.toHaveProperty('verificationTokenExpiresAt');

    // The dispatched token is a signed JWT that resolves back to the user's id.
    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    const [dispatchedTo, dispatchedToken] = mockedSendVerificationEmail.mock.calls[0];
    expect(dispatchedTo).toBe('alice@example.com');
    expect(typeof dispatchedToken).toBe('string');
    const { verifyVerificationToken } = await import('../../src/utils/jwt.js');
    expect(verifyVerificationToken(dispatchedToken as string)).toEqual({ userId: 'u1' });
  });

  it('hashes the submitted password before persisting it', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    mockedUser.create.mockImplementationOnce(async (args: { data: Record<string, unknown> }) => {
      return dbUser({
        email: args.data.email as string,
        name: args.data.name as string,
        passwordHash: args.data.passwordHash as string,
      }) as never;
    });

    await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'mypassword', name: 'Alice' });

    const createArgs = mockedUser.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data.passwordHash).not.toBe('mypassword');
    expect(createArgs.data.passwordHash as string).toMatch(/^\$2[ab]\$12\$/);
  });

  it('returns the same generic response when the email is already registered (no enumeration)', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never);

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'hunter2pw', name: 'Alice' });

    // Status and body must match the success branch exactly.
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/confirm/i);
    expect(res.body.user).toBeUndefined();

    // No new account is created and no verification email is sent to the caller.
    expect(mockedUser.create).not.toHaveBeenCalled();
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();

    // The existing account is notified that someone tried to re-register with
    // their email. This gives a real account owner a chance to notice and
    // react, without revealing to the caller whether the email existed.
    expect(mockedSendRegistrationCollisionEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendRegistrationCollisionEmail).toHaveBeenCalledWith('alice@example.com');
  });

  it('returns 400 when the body fails schema validation', async () => {
    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' });

    expect(res.status).toBe(400);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('returns an access token and sets a refresh cookie on valid credentials', async () => {
    const hash = await hashPassword('hunter2pw');
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: hash }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'hunter2pw' });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'USER',
    });
    expect(verifyAccessToken(res.body.accessToken)).toMatchObject({ id: 'u1' });
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('returns 401 when no user exists for the email', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'hunter2pw' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 when the password does not match', async () => {
    const hash = await hashPassword('correct-password');
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: hash }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 403 when the user is banned', async () => {
    const hash = await hashPassword('hunter2pw');
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: hash, isBanned: true }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'hunter2pw' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Account is banned' });
  });

  it('returns 403 when the email has not been verified', async () => {
    const hash = await hashPassword('hunter2pw');
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: hash, emailVerified: false }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'hunter2pw' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/confirm your email/i);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns 400 when the body fails schema validation', async () => {
    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies the user when the JWT token is valid', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ emailVerified: false }) as never,
    );
    mockedUser.update.mockResolvedValueOnce(dbUser({ emailVerified: true }) as never);

    const token = signVerificationToken('u1');
    const res = await request(makeApp())
      .post('/api/auth/verify-email')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
    expect(mockedUser.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerified: true },
    });
  });

  it('returns success idempotently when the user is already verified', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ emailVerified: true }) as never,
    );

    const token = signVerificationToken('u1');
    const res = await request(makeApp())
      .post('/api/auth/verify-email')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already verified|verified/i);
    expect(mockedUser.update).not.toHaveBeenCalled();
  });

  it('returns 400 when no token is provided', async () => {
    const res = await request(makeApp()).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 when the token is not a valid JWT', async () => {
    const res = await request(makeApp())
      .post('/api/auth/verify-email')
      .send({ token: 'not-a-jwt' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 when the JWT is valid but the user no longer exists', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    const token = signVerificationToken('ghost');
    const res = await request(makeApp())
      .post('/api/auth/verify-email')
      .send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('rejects an access token being used as a verification token', async () => {
    const accessToken = signAccessToken({ id: 'u1', email: 'alice@example.com', role: 'USER' });
    const res = await request(makeApp())
      .post('/api/auth/verify-email')
      .send({ token: accessToken });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('dispatches a fresh JWT verification email for an unverified user without touching the DB', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ emailVerified: false }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/resend-verification')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmation email/i);

    // Stateless flow: no DB write on resend.
    expect(mockedUser.update).not.toHaveBeenCalled();

    // The dispatched token resolves back to the user's id.
    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    const [dispatchedTo, dispatchedToken] = mockedSendVerificationEmail.mock.calls[0];
    expect(dispatchedTo).toBe('alice@example.com');
    const { verifyVerificationToken } = await import('../../src/utils/jwt.js');
    expect(verifyVerificationToken(dispatchedToken as string)).toEqual({ userId: 'u1' });
  });

  it('returns the same generic message and skips sending when the user is already verified', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ emailVerified: true }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/resend-verification')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmation email/i);
    expect(mockedUser.update).not.toHaveBeenCalled();
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns the same generic message when the email is not registered', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/auth/resend-verification')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmation email/i);
    expect(mockedUser.update).not.toHaveBeenCalled();
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('dispatches a reset email for a matching account', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: 'hashed-password-abc' }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset email/i);

    // The dispatched token is a signed JWT bound to the user's current hash fingerprint.
    expect(mockedSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, token] = mockedSendPasswordResetEmail.mock.calls[0];
    expect(to).toBe('alice@example.com');
    const decoded = verifyPasswordResetToken(token as string);
    expect(decoded).toEqual({ userId: 'u1', pv: passwordFingerprint('hashed-password-abc') });
  });

  it('returns the same generic response when the email is not registered (no enumeration)', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);

    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset email/i);
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not dispatch for banned accounts (but returns the same message)', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ isBanned: true }) as never,
    );

    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password reset email/i);
    expect(mockedSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejects malformed email', async () => {
    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('updates the password when the token and fingerprint are valid', async () => {
    const currentHash = 'hashed-password-abc';
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: currentHash }) as never,
    );
    mockedUser.update.mockResolvedValueOnce(dbUser() as never);
    const token = signPasswordResetToken({ id: 'u1', passwordHash: currentHash });

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token, password: 'new-password-123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password updated/i);
    // The stored hash is bcrypt-ish and is NOT the raw password.
    const updateArgs = mockedUser.update.mock.calls[0][0] as { data: { passwordHash: string } };
    expect(updateArgs.data.passwordHash).not.toBe('new-password-123');
    expect(updateArgs.data.passwordHash).toMatch(/^\$2[ab]\$12\$/);
  });

  it('rejects when the password hash fingerprint no longer matches (e.g. link already used)', async () => {
    const oldHash = 'hashed-password-abc';
    const newHash = 'hashed-password-xyz';
    mockedUser.findUnique.mockResolvedValueOnce(
      dbUser({ passwordHash: newHash }) as never,
    );
    const staleToken = signPasswordResetToken({ id: 'u1', passwordHash: oldHash });

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: staleToken, password: 'doesnt-matter-123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(mockedUser.update).not.toHaveBeenCalled();
  });

  it('rejects when the token is not a valid reset JWT', async () => {
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-jwt', password: 'new-password-123' });
    expect(res.status).toBe(400);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when the user has been deleted', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    const token = signPasswordResetToken({ id: 'u1', passwordHash: 'hashed' });

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token, password: 'new-password-123' });
    expect(res.status).toBe(400);
    expect(mockedUser.update).not.toHaveBeenCalled();
  });

  it('rejects an access token being used as a reset token', async () => {
    const accessToken = signAccessToken({ id: 'u1', email: 'a@b.com', role: 'USER' });
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: accessToken, password: 'new-password-123' });
    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: 'any', password: 'short' });
    expect(res.status).toBe(400);
    expect(mockedUser.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/refresh', () => {
  const payload = { id: 'u1', email: 'alice@example.com', role: 'USER' };

  it('issues a new access token when the refresh cookie is valid', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never);
    const token = signRefreshToken(payload);

    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);

    expect(res.status).toBe(200);
    expect(verifyAccessToken(res.body.accessToken)).toMatchObject({ id: 'u1' });
  });

  it('sets a fresh, valid refresh cookie on success (rotation)', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never);
    const oldToken = signRefreshToken(payload);

    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldToken}`]);

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const newCookie = cookies?.find((c) => c.startsWith('refreshToken='))!;
    expect(newCookie).toBeDefined();
    const newToken = newCookie.split(';')[0].split('=')[1];
    // We don't assert newToken !== oldToken — JWT iat is seconds-resolution
    // so same-payload signs within a second produce byte-identical tokens.
    // What matters is that a fresh Set-Cookie was issued and the token is valid.
    expect(verifyRefreshToken(newToken)).toMatchObject({ id: 'u1' });
    expect(newCookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 when no refresh cookie is sent', async () => {
    const res = await request(makeApp()).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No refresh token' });
  });

  it('returns 401 when the refresh cookie is invalid', async () => {
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=garbage']);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid refresh token' });
  });

  it('returns 401 when an access token is sent in the refresh cookie', async () => {
    const accessToken = signAccessToken(payload);
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${accessToken}`]);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the user has been deleted', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    const token = signRefreshToken(payload);
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not found or banned/i);
  });

  it('returns 401 when the user is banned', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(dbUser({ isBanned: true }) as never);
    const token = signRefreshToken(payload);
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie and responds with a success message', async () => {
    const res = await request(makeApp()).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logged out' });

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cleared = cookies?.find((c) => c.startsWith('refreshToken='));
    expect(cleared).toBeDefined();
    // clearCookie sets value to "" and an expiry in the past.
    expect(cleared).toMatch(/refreshToken=;/);
    expect(cleared).toMatch(/Expires=/i);
  });
});

describe('GET /api/auth/me', () => {
  const payload = { id: 'u1', email: 'alice@example.com', role: 'USER' };

  it('returns the profile fields for the authenticated user', async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
      bio: null,
      location: null,
      latitude: null,
      longitude: null,
      skills: [],
      role: 'USER',
      createdAt: new Date('2020-01-01T00:00:00Z'),
    } as never);

    const token = signAccessToken(payload);
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'USER',
    });
    // Ensure the returned shape does not include password fields or ban flag.
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('isBanned');
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(makeApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the user record has been deleted', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null as never);
    const token = signAccessToken(payload);
    const res = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
  });
});
