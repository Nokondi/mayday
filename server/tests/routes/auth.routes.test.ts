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
}));

import { prisma } from '../../src/config/database.js';
import { errorMiddleware } from '../../src/middleware/error.middleware.js';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { sendVerificationEmail } from '../../src/services/mail.service.js';
import {
  signAccessToken,
  signRefreshToken,
  signVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';

const mockedUser = vi.mocked(prisma.user);
const mockedSendVerificationEmail = vi.mocked(sendVerificationEmail);

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
    expect(res.body.user).toEqual({
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(res.body.message).toMatch(/confirm/i);
    // Register no longer issues tokens — login is blocked until verification.
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

  it('returns 409 when the email is already registered', async () => {
    mockedUser.findUnique.mockResolvedValueOnce(dbUser() as never);

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'hunter2pw', name: 'Alice' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already registered' });
    expect(mockedUser.create).not.toHaveBeenCalled();
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
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
