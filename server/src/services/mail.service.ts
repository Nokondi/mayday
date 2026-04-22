import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP not configured; skipping verification email to ${to}`);
    return;
  }

  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: 'Confirm your Mayday account',
    text: `Welcome to Mayday!\n\nConfirm your email by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to Mayday!</p>
      <p>Confirm your email by clicking the link below:</p>
      <p><a href="${verifyUrl}">Confirm my email</a></p>
      <p>Or paste this URL into your browser:<br><code>${verifyUrl}</code></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
