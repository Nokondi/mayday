import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/jwt.js';

const payload = { id: 'u1', email: 'a@b.com', role: 'USER' };

describe('signAccessToken / verifyAccessToken', () => {
  it('produces a verifiable token carrying the payload fields', () => {
    const token = signAccessToken(payload);
    const verified = verifyAccessToken(token);
    expect(verified).toMatchObject(payload);
  });

  it('sets a 15-minute expiration on access tokens', () => {
    const token = signAccessToken(payload);
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    // 15 minutes = 900 seconds; allow a small window for execution delay.
    expect(decoded.exp! - decoded.iat!).toBe(15 * 60);
  });

  it('returns null for a malformed token instead of throwing', () => {
    expect(verifyAccessToken('not-a-jwt')).toBeNull();
  });

  it('returns null for a token signed with the wrong secret', () => {
    const foreign = jwt.sign(payload, 'some-other-secret-at-least-32-chars-long');
    expect(verifyAccessToken(foreign)).toBeNull();
  });

  it('returns null for an expired access token', () => {
    const expired = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '-1s' });
    expect(verifyAccessToken(expired)).toBeNull();
  });

  it('does not accept a refresh token as an access token', () => {
    const refresh = signRefreshToken(payload);
    expect(verifyAccessToken(refresh)).toBeNull();
  });
});

describe('signRefreshToken / verifyRefreshToken', () => {
  it('produces a verifiable refresh token carrying the payload fields', () => {
    const token = signRefreshToken(payload);
    const verified = verifyRefreshToken(token);
    expect(verified).toMatchObject(payload);
  });

  it('sets a 7-day expiration on refresh tokens', () => {
    const token = signRefreshToken(payload);
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(7 * 24 * 60 * 60);
  });

  it('returns null for a malformed token instead of throwing', () => {
    expect(verifyRefreshToken('not-a-jwt')).toBeNull();
  });

  it('returns null for a refresh token signed with the wrong secret', () => {
    const foreign = jwt.sign(payload, 'some-other-secret-at-least-32-chars-long');
    expect(verifyRefreshToken(foreign)).toBeNull();
  });

  it('does not accept an access token as a refresh token', () => {
    const access = signAccessToken(payload);
    expect(verifyRefreshToken(access)).toBeNull();
  });
});
