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
