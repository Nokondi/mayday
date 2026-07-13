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

describe('sendBugReportAdminEmail', () => {
  it('no-ops when SMTP credentials are not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendBugReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendBugReportAdminEmail('admin@example.com', 'Alice', 'Crash on load');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });

  it('sends an admin email with the reporter, title, and a link to /admin', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendBugReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendBugReportAdminEmail('admin@example.com', 'Alice', 'Crash on load');

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0] as {
      to: string; subject: string; text: string; html: string;
    };
    expect(mail.to).toBe('admin@example.com');
    expect(mail.subject).toBe('New bug report from Alice: Crash on load');
    expect(mail.text).toContain('Alice');
    expect(mail.text).toContain('Crash on load');
    expect(mail.text).toContain('https://mayday.test/admin');
    expect(mail.html).toContain('https://mayday.test/admin');
  });

  it('escapes HTML in the reporter name and title to prevent injection in the html body', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendBugReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendBugReportAdminEmail(
      'admin@example.com',
      '<img src=x onerror=alert(1)>',
      '<script>alert("x")</script>',
    );

    const mail = sendMailMock.mock.calls[0][0] as { html: string };
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('sendUserReportAdminEmail', () => {
  it('no-ops when SMTP credentials are not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendUserReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendUserReportAdminEmail('admin@example.com', 'Alice', 'Harassment', 'user');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });

  it('labels user-target reports as "user report" in the subject', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendUserReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendUserReportAdminEmail('admin@example.com', 'Alice', 'Harassment', 'user');

    const mail = sendMailMock.mock.calls[0][0] as { subject: string; text: string; html: string };
    expect(mail.subject).toBe('New user report from Alice: Harassment');
    expect(mail.html).toContain('https://mayday.test/admin');
  });

  it('labels content-target reports as "content report" in the subject', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendUserReportAdminEmail } = await import('../../src/services/mail.service.js');
    await sendUserReportAdminEmail('admin@example.com', 'Alice', 'Spam', 'content');

    const mail = sendMailMock.mock.calls[0][0] as { subject: string };
    expect(mail.subject).toBe('New content report from Alice: Spam');
  });
});

describe('sendNewMessageEmail', () => {
  it('renders a preview blockquote when given a plaintext preview string', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail('to@example.com', 'Bob', 'Hello there');

    const mail = sendMailMock.mock.calls[0][0] as {
      subject: string; text: string; html: string;
    };
    expect(mail.subject).toBe('New message from Bob on Mayday');
    expect(mail.text).toContain('Hello there');
    expect(mail.html).toContain('<blockquote');
    expect(mail.html).toContain('Hello there');
  });

  it('truncates preview past 280 chars with an ellipsis', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const long = 'x'.repeat(400);
    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail('to@example.com', 'Bob', long);

    const mail = sendMailMock.mock.calls[0][0] as { html: string };
    expect(mail.html).toContain('x'.repeat(280) + '…');
    expect(mail.html).not.toContain('x'.repeat(400));
  });

  it('escapes HTML in sender name to prevent injection', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail(
      'to@example.com',
      '<img src=x onerror=alert(1)>',
      'plain',
    );

    const mail = sendMailMock.mock.calls[0][0] as { html: string };
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders the no-blockquote variant when preview is null (E2EE encrypted message)', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail('to@example.com', 'Bob', null);

    const mail = sendMailMock.mock.calls[0][0] as {
      subject: string; text: string; html: string;
    };
    expect(mail.subject).toBe('New message from Bob on Mayday');
    // No blockquote and no preview text in either body — the only signal
    // is "someone sent you a message; click to read".
    expect(mail.html).not.toContain('<blockquote');
    expect(mail.text).toContain('Open your inbox');
    expect(mail.html).toContain('https://mayday.test/messages');
    // Should still HTML-escape the sender name even on the encrypted path.
  });

  it('encrypted path: still HTML-escapes the sender name', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail(
      'to@example.com',
      '<script>alert(1)</script>',
      null,
    );

    const mail = sendMailMock.mock.calls[0][0] as { html: string };
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('no-ops when SMTP is not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendNewMessageEmail } = await import('../../src/services/mail.service.js');
    await sendNewMessageEmail('to@example.com', 'Bob', 'Hello');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
  });
});

describe('sendNewCommentEmail', () => {
  it('sends with the commenter, post title, and a link to /posts/:id', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewCommentEmail } = await import('../../src/services/mail.service.js');
    await sendNewCommentEmail('to@example.com', 'Bob', 'Need help moving', 'post-1');

    const mail = sendMailMock.mock.calls[0][0] as {
      subject: string; text: string; html: string;
    };
    expect(mail.subject).toBe('Bob commented on "Need help moving"');
    expect(mail.text).toContain('Need help moving');
    expect(mail.html).toContain('https://mayday.test/posts/post-1');
  });

  it('escapes HTML in the commenter name and post title to prevent injection', async () => {
    process.env.SMTP_USER = 'bot@example.com';
    process.env.SMTP_PASS = 'secret';

    const { sendNewCommentEmail } = await import('../../src/services/mail.service.js');
    await sendNewCommentEmail(
      'to@example.com',
      '<img src=x onerror=alert(1)>',
      '<script>alert(2)</script>',
      'post-1',
    );

    const mail = sendMailMock.mock.calls[0][0] as { html: string };
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('no-ops when SMTP is not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendNewCommentEmail } = await import('../../src/services/mail.service.js');
    await sendNewCommentEmail('to@example.com', 'Bob', 'Title', 'post-1');

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SMTP not configured/));
    warn.mockRestore();
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
