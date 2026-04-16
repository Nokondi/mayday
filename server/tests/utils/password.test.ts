import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from '../../src/utils/password.js';

describe('hashPassword', () => {
  it('returns a bcrypt-shaped string for a given password', async () => {
    const hash = await hashPassword('hunter2');
    // bcrypt output format: $2[ab]$<cost>$<22 chars><31 chars>
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
    expect(hash.length).toBeGreaterThanOrEqual(60);
  });

  it('does not return the plaintext password', async () => {
    const hash = await hashPassword('hunter2');
    expect(hash).not.toContain('hunter2');
  });

  it('produces a different hash for the same password on each call (unique salt)', async () => {
    const a = await hashPassword('hunter2');
    const b = await hashPassword('hunter2');
    expect(a).not.toBe(b);
  });

  it('uses a cost factor of 12', async () => {
    const hash = await hashPassword('hunter2');
    // Cost is the number between the 2nd and 3rd $ signs.
    const cost = hash.split('$')[2];
    expect(cost).toBe('12');
  });
});

describe('comparePassword', () => {
  it('returns true when the plaintext matches the hash', async () => {
    const hash = await hashPassword('hunter2');
    await expect(comparePassword('hunter2', hash)).resolves.toBe(true);
  });

  it('returns false when the plaintext does not match the hash', async () => {
    const hash = await hashPassword('hunter2');
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });

  it('is case-sensitive', async () => {
    const hash = await hashPassword('Hunter2');
    await expect(comparePassword('hunter2', hash)).resolves.toBe(false);
    await expect(comparePassword('Hunter2', hash)).resolves.toBe(true);
  });

  it('returns false for an empty candidate against a real hash', async () => {
    const hash = await hashPassword('hunter2');
    await expect(comparePassword('', hash)).resolves.toBe(false);
  });
});
