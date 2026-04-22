import { Router } from 'express';
import { randomBytes } from 'crypto';
import { registerSchema, loginSchema, resendVerificationSchema } from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middleware/error.middleware.js';
import { sendVerificationEmail } from '../services/mail.service.js';

export const authRoutes = Router();

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function generateVerificationToken(): { token: string; expiresAt: Date } {
  return {
    token: randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
}

function dispatchVerificationEmail(email: string, token: string) {
  sendVerificationEmail(email, token).catch((err) => {
    console.error(`[auth] Failed to send verification email to ${email}:`, err);
  });
}

function setRefreshCookie(res: import('express').Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

authRoutes.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await hashPassword(password);
    const { token, expiresAt } = generateVerificationToken();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        verificationToken: token,
        verificationTokenExpiresAt: expiresAt,
      },
    });

    dispatchVerificationEmail(user.email, token);

    res.status(201).json({
      message: 'Account created. Check your email to confirm your address before logging in.',
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) { next(err); }
});

authRoutes.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(401, 'Invalid credentials');
    if (user.isBanned) throw new AppError(403, 'Account is banned');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    if (!user.emailVerified) {
      throw new AppError(403, 'Please confirm your email address before logging in.');
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
    });
  } catch (err) { next(err); }
});

authRoutes.get('/verify-email', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) throw new AppError(400, 'Missing verification token');

    const user = await prisma.user.findUnique({ where: { verificationToken: token } });
    if (!user) throw new AppError(400, 'Invalid or expired verification token');
    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new AppError(400, 'Verification token has expired. Request a new one.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) { next(err); }
});

authRoutes.post('/resend-verification', validate(resendVerificationSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same response to avoid leaking which emails are registered.
    const genericResponse = { message: 'If that account exists and is unverified, a new confirmation email has been sent.' };

    if (!user || user.emailVerified || user.isBanned) {
      res.json(genericResponse);
      return;
    }

    const { token, expiresAt } = generateVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: token, verificationTokenExpiresAt: expiresAt },
    });

    dispatchVerificationEmail(user.email, token);
    res.json(genericResponse);
  } catch (err) { next(err); }
});

authRoutes.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError(401, 'No refresh token');

    const payload = verifyRefreshToken(token);
    if (!payload) throw new AppError(401, 'Invalid refresh token');

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.isBanned) throw new AppError(401, 'User not found or banned');

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    // Rotate: issue a fresh refresh token and overwrite the old cookie
    const newRefreshToken = signRefreshToken(tokenPayload);
    setRefreshCookie(res, newRefreshToken);

    res.json({ accessToken });
  } catch (err) { next(err); }
});

authRoutes.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

authRoutes.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, name: true, bio: true,
        location: true, latitude: true, longitude: true,
        skills: true, role: true, avatarUrl: true, createdAt: true,
      },
    });
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (err) { next(err); }
});
