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

export async function sendRegistrationCollisionEmail(to: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP not configured; skipping registration-collision email to ${to}`);
    return;
  }

  const loginUrl = `${env.CLIENT_URL}/login`;
  const resetUrl = `${env.CLIENT_URL}/forgot-password`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: 'Someone tried to sign up with your Mayday email',
    text: `Someone just tried to create a new Mayday account with this email address.

You already have an account here. If it was you and you've forgotten your password, reset it:
${resetUrl}

If it wasn't you, no action is needed — your account wasn't changed.

Sign in: ${loginUrl}`,
    html: `
      <p>Someone just tried to create a new Mayday account with this email address.</p>
      <p>You already have an account here. If it was you and you've forgotten your password, you can <a href="${resetUrl}">reset it</a>.</p>
      <p>If it wasn't you, no action is needed — your account wasn't changed.</p>
      <p><a href="${loginUrl}">Sign in to Mayday</a></p>
    `,
  });
}

export async function sendNewMessageEmail(
  to: string,
  senderName: string,
  messagePreview: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP not configured; skipping new-message email to ${to}`);
    return;
  }

  const inboxUrl = `${env.CLIENT_URL}/messages`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const safePreview = messagePreview.length > 280
    ? messagePreview.slice(0, 280) + '…'
    : messagePreview;
  const escapedPreview = safePreview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedSender = senderName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  await t.sendMail({
    from,
    to,
    subject: `New message from ${senderName} on Mayday`,
    text: `${senderName} sent you a message on Mayday:\n\n"${safePreview}"\n\nReply: ${inboxUrl}`,
    html: `
      <p><strong>${escapedSender}</strong> sent you a message on Mayday:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escapedPreview}</blockquote>
      <p><a href="${inboxUrl}">Open your inbox</a> to reply.</p>
    `,
  });
}

export async function sendCommunityJoinRequestEmail(
  to: string,
  requesterName: string,
  communityName: string,
  communityId: string,
  requestMessage: string | null,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP not configured; skipping community-join-request email to ${to}`);
    return;
  }

  const requestsUrl = `${env.CLIENT_URL}/communities/${communityId}/manage`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedRequester = escape(requesterName);
  const escapedCommunity = escape(communityName);
  const messageBlockHtml = requestMessage
    ? `<p>They wrote:</p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escape(requestMessage)}</blockquote>`
    : '';
  const messageBlockText = requestMessage ? `\n\nThey wrote:\n"${requestMessage}"` : '';

  await t.sendMail({
    from,
    to,
    subject: `${requesterName} wants to join ${communityName}`,
    text: `${requesterName} has requested to join the "${communityName}" community on Mayday.${messageBlockText}\n\nReview pending requests: ${requestsUrl}`,
    html: `
      <p><strong>${escapedRequester}</strong> has requested to join the <strong>${escapedCommunity}</strong> community on Mayday.</p>
      ${messageBlockHtml}
      <p><a href="${requestsUrl}">Review pending requests</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[mail] SMTP not configured; skipping password reset email to ${to}`);
    return;
  }

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: 'Reset your Mayday password',
    text: `Someone requested a password reset for your Mayday account.\n\nIf that was you, open this link to choose a new password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.`,
    html: `
      <p>Someone requested a password reset for your Mayday account.</p>
      <p>If that was you, click the link below to choose a new password:</p>
      <p><a href="${resetUrl}">Reset my password</a></p>
      <p>Or paste this URL into your browser:<br><code>${resetUrl}</code></p>
      <p>This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
    `,
  });
}
