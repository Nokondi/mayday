import { Router } from 'express';
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@mayday/shared';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  signVerificationToken,
  signPasswordResetToken,
  verifyRefreshToken,
  verifyVerificationToken,
  verifyPasswordResetToken,
  passwordFingerprint,
} from '../utils/jwt.js';
import { AppError } from '../middleware/error.middleware.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationCollisionEmail,
} from '../services/mail.service.js';

export const authRoutes = Router();

function dispatchPasswordResetEmail(email: string, token: string) {
  sendPasswordResetEmail(email, token).catch((err) => {
    console.error(`[auth] Failed to send password reset email to ${email}:`, err);
  });
}

function dispatchVerificationEmail(email: string, token: string) {
  sendVerificationEmail(email, token).catch((err) => {
    console.error(`[auth] Failed to send verification email to ${email}:`, err);
  });
}

function dispatchRegistrationCollisionEmail(email: string) {
  sendRegistrationCollisionEmail(email).catch((err) => {
    console.error(`[auth] Failed to send registration-collision email to ${email}:`, err);
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

// Registration always returns the same generic 201 response regardless of
// whether the email was already registered, so the endpoint can't be used
// to enumerate accounts. On collision we notify the existing account (so a
// real owner knows someone tried to sign up with their address) and run a
// throwaway bcrypt hash so the response time of both branches is within
// bcrypt's variance.
authRoutes.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const genericResponse = {
      message: 'Check your email to confirm your address before logging in.',
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      dispatchRegistrationCollisionEmail(existing.email);
      await hashPassword(password);
      res.status(201).json(genericResponse);
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    dispatchVerificationEmail(user.email, signVerificationToken(user.id));

    res.status(201).json(genericResponse);
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

authRoutes.post('/verify-email', async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) throw new AppError(400, 'Missing verification token');

    const payload = verifyVerificationToken(token);
    if (!payload) throw new AppError(400, 'Invalid or expired verification token');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError(400, 'Invalid or expired verification token');

    if (user.emailVerified) {
      res.json({ message: 'Email already verified. You can now log in.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
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

    dispatchVerificationEmail(user.email, signVerificationToken(user.id));
    res.json(genericResponse);
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — issue a reset link if the email matches.
// Always returns the same generic response to avoid leaking which emails exist.
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericResponse = {
      message: 'If that account exists, a password reset email has been sent.',
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.isBanned) {
      res.json(genericResponse);
      return;
    }

    dispatchPasswordResetEmail(user.email, signPasswordResetToken(user));
    res.json(genericResponse);
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password — consume a reset token and set a new password.
// The token is single-use in practice: we verify its `pv` claim still matches
// the user's current password hash fingerprint, which changes on success.
authRoutes.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const payload = verifyPasswordResetToken(token);
    if (!payload) throw new AppError(400, 'Invalid or expired reset link');

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new AppError(400, 'Invalid or expired reset link');
    if (passwordFingerprint(user.passwordHash) !== payload.pv) {
      throw new AppError(400, 'Invalid or expired reset link');
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated. You can now log in.' });
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
