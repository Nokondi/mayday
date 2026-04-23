import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Email verification tokens are stateless JWTs: the signature + expiry are
// the authority. We don't store them in the DB, so resending a verification
// email doesn't invalidate prior tokens, and verifying is idempotent.
const VERIFICATION_AUDIENCE = 'verify-email';

export function signVerificationToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    audience: VERIFICATION_AUDIENCE,
    expiresIn: '24h',
  });
}

export function verifyVerificationToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      audience: VERIFICATION_AUDIENCE,
    }) as { sub?: string };
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// Password reset tokens are stateless JWTs with a 1-hour TTL that also bind to
// the user's current password hash via a fingerprint claim (`pv` = "password
// version"). As soon as the password is successfully changed, the fingerprint
// no longer matches and every previously-issued reset link is rejected as
// invalid — single-use behavior with no DB state needed.
const PASSWORD_RESET_AUDIENCE = 'reset-password';

export function passwordFingerprint(passwordHash: string): string {
  return passwordHash.slice(-10);
}

export function signPasswordResetToken(user: { id: string; passwordHash: string }): string {
  return jwt.sign(
    { sub: user.id, pv: passwordFingerprint(user.passwordHash) },
    env.JWT_SECRET,
    { audience: PASSWORD_RESET_AUDIENCE, expiresIn: '1h' },
  );
}

export function verifyPasswordResetToken(
  token: string,
): { userId: string; pv: string } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      audience: PASSWORD_RESET_AUDIENCE,
    }) as { sub?: string; pv?: string };
    if (typeof payload.sub !== 'string' || typeof payload.pv !== 'string') return null;
    return { userId: payload.sub, pv: payload.pv };
  } catch {
    return null;
  }
}
