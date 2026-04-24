import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent the env module from loading values from the repo's real .env file.
vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }));

const sendMailMock = vi.fn().mockResolvedValue({ accepted: ['to@example.com'] });
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  // Wipe all env vars so tests start from a known blank slate.
  for (const k of Object.keys(process.env)) delete process.env[k];
  process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/z';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.CLIENT_URL = 'https://mayday.test';
  process.env.NODE_ENV = 'test';
});

describe('sendVerificationEmail', () => {
  it('no-ops when SMTP credentials are not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendVerificationEmail } = await import('../../src/services/mail.service.js');
    await sendVerificationEmail('to@example.com', 'tok123');

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });

  it('sends via SMTP when configured and encodes the token into the link', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_FROM = 'Mayday <bot@example.com>';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';

    const { sendVerificationEmail } = await import('../../src/services/mail.service.js');
    await sendVerificationEmail('to@example.com', 'tok with space');

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'bot@example.com', pass: 'secret' },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const mail = sendMailMock.mock.calls[0][0] as {
      from: string; to: string; subject: string; text: string; html: string;
    };
    expect(mail.from).toBe('Mayday <bot@example.com>');
    expect(mail.to).toBe('to@example.com');
    expect(mail.subject).toMatch(/confirm/i);
    // Token must be URL-encoded in the link and resolvable with decodeURIComponent.
    expect(mail.text).toContain('https://mayday.test/verify-email?token=tok%20with%20space');
    expect(mail.html).toContain('https://mayday.test/verify-email?token=tok%20with%20space');
  });

  it('falls back to SMTP_USER for the From address when SMTP_FROM is unset', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';
    delete process.env.SMTP_FROM;

    const { sendVerificationEmail } = await import('../../src/services/mail.service.js');
    await sendVerificationEmail('to@example.com', 'tok');

    const mail = sendMailMock.mock.calls[0][0] as { from: string };
    expect(mail.from).toBe('bot@example.com');
  });

  it('uses a secure connection on port 465', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_PORT = '465';

    const { sendVerificationEmail } = await import('../../src/services/mail.service.js');
    await sendVerificationEmail('to@example.com', 'tok');

    expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
  });
});

describe('sendPasswordResetEmail', () => {
  it('no-ops when SMTP credentials are not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendPasswordResetEmail } = await import('../../src/services/mail.service.js');
    await sendPasswordResetEmail('to@example.com', 'tok');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });

  it('sends via SMTP with a reset link pointing at /reset-password and URL-encodes the token', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendPasswordResetEmail } = await import('../../src/services/mail.service.js');
    await sendPasswordResetEmail('to@example.com', 'tok with space');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0] as {
      to: string; subject: string; text: string; html: string;
    };
    expect(mail.to).toBe('to@example.com');
    expect(mail.subject).toMatch(/reset.*password/i);
    expect(mail.text).toContain('https://mayday.test/reset-password?token=tok%20with%20space');
    expect(mail.html).toContain('https://mayday.test/reset-password?token=tok%20with%20space');
  });
});

describe('sendRegistrationCollisionEmail', () => {
  it('no-ops when SMTP credentials are not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendRegistrationCollisionEmail } = await import('../../src/services/mail.service.js');
    await sendRegistrationCollisionEmail('to@example.com');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });

  it('sends a notice that links to login and password reset without exposing a token', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendRegistrationCollisionEmail } = await import('../../src/services/mail.service.js');
    await sendRegistrationCollisionEmail('to@example.com');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0] as {
      to: string; subject: string; text: string; html: string;
    };
    expect(mail.to).toBe('to@example.com');
    expect(mail.subject).toMatch(/tried to sign up/i);
    expect(mail.text).toContain('https://mayday.test/login');
    expect(mail.text).toContain('https://mayday.test/forgot-password');
    expect(mail.html).toContain('https://mayday.test/login');
    expect(mail.html).toContain('https://mayday.test/forgot-password');
    // No token should appear in either body — this email is an existence notice,
    // not an action link that authenticates anything.
    expect(mail.text).not.toMatch(/token=/);
    expect(mail.html).not.toMatch(/token=/);
  });
});
