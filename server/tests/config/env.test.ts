import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent the real repo .env from leaking into the test process.
vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }));

// The env module parses process.env at import time, so each scenario must
// reset the module cache and set vars before importing.
const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  // Start from a clean slate each test.
  for (const k of Object.keys(process.env)) delete process.env[k];
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, ORIGINAL);
});

function baseDev() {
  process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/z';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.NODE_ENV = 'development';
}

describe('env config', () => {
  it('parses the minimal required env and uses defaults for optional fields', async () => {
    baseDev();
    const { env } = await import('../../src/config/env.js');
    expect(env.DATABASE_URL).toBe('postgresql://x:y@localhost:5432/z');
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CLIENT_URL).toBe('http://localhost:5173');
    expect(env.SMTP_HOST).toBe('smtp.gmail.com');
    expect(env.SMTP_PORT).toBe(587);
  });

  it('rejects a too-short JWT_SECRET', async () => {
    baseDev();
    process.env.JWT_SECRET = 'too-short';
    await expect(import('../../src/config/env.js')).rejects.toThrow();
  });

  it('rejects a too-short JWT_REFRESH_SECRET', async () => {
    baseDev();
    process.env.JWT_REFRESH_SECRET = 'too-short';
    await expect(import('../../src/config/env.js')).rejects.toThrow();
  });

  it('coerces PORT from string to number', async () => {
    baseDev();
    process.env.PORT = '4444';
    const { env } = await import('../../src/config/env.js');
    expect(env.PORT).toBe(4444);
  });

  it('refuses to start in production with a localhost CLIENT_URL', async () => {
    baseDev();
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'http://localhost:5173';
    await expect(import('../../src/config/env.js')).rejects.toThrow(/CLIENT_URL/);
  });

  it('refuses to start in production with a 127.0.0.1 CLIENT_URL', async () => {
    baseDev();
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'http://127.0.0.1:3000';
    await expect(import('../../src/config/env.js')).rejects.toThrow(/CLIENT_URL/);
  });

  it('accepts a real public CLIENT_URL in production', async () => {
    baseDev();
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://mayday.community';
    const { env } = await import('../../src/config/env.js');
    expect(env.CLIENT_URL).toBe('https://mayday.community');
  });

  it('allows localhost CLIENT_URL in development', async () => {
    baseDev();
    process.env.CLIENT_URL = 'http://localhost:5173';
    const { env } = await import('../../src/config/env.js');
    expect(env.CLIENT_URL).toBe('http://localhost:5173');
  });
});
