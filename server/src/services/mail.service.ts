import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  if (transporter) return transporter;
  const options = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  };
  transporter = env.SMTP_REPLY_TO
    ? nodemailer.createTransport(options, { replyTo: env.SMTP_REPLY_TO })
    : nodemailer.createTransport(options);
  return transporter;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping verification email to ${to}`,
    );
    return;
  }

  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: "Confirm your Mayday account",
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

export async function sendRegistrationCollisionEmail(
  to: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping registration-collision email to ${to}`,
    );
    return;
  }

  const loginUrl = `${env.CLIENT_URL}/login`;
  const resetUrl = `${env.CLIENT_URL}/forgot-password`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: "Someone tried to sign up with your Mayday email",
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
  // E2EE: pass null when the message is encrypted. The email then renders
  // without the blockquote — sender name and a link to the inbox only.
  // Plaintext (legacy / E2EE-off) calls continue to pass the preview string.
  messagePreview: string | null,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping new-message email to ${to}`,
    );
    return;
  }

  const inboxUrl = `${env.CLIENT_URL}/messages`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escapedSender = senderName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (messagePreview === null) {
    await t.sendMail({
      from,
      to,
      subject: `New message from ${senderName} on Mayday`,
      text: `${senderName} sent you a message on Mayday.\n\nOpen your inbox to read and reply: ${inboxUrl}`,
      html: `
        <p><strong>${escapedSender}</strong> sent you a message on Mayday.</p>
        <p><a href="${inboxUrl}">Open your inbox</a> to read and reply.</p>
      `,
    });
    return;
  }

  const safePreview =
    messagePreview.length > 280
      ? messagePreview.slice(0, 280) + "…"
      : messagePreview;
  const escapedPreview = safePreview
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

export async function sendNewCommentEmail(
  to: string,
  commenterName: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping new-comment email to ${to}`,
    );
    return;
  }

  const postUrl = `${env.CLIENT_URL}/posts/${postId}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedCommenter = escape(commenterName);
  const escapedTitle = escape(postTitle);

  await t.sendMail({
    from,
    to,
    subject: `${commenterName} commented on "${postTitle}"`,
    text: `${commenterName} commented on the post "${postTitle}" on Mayday.\n\nView the discussion: ${postUrl}`,
    html: `
      <p><strong>${escapedCommenter}</strong> commented on the post <strong>"${escapedTitle}"</strong> on Mayday.</p>
      <p><a href="${postUrl}">View the discussion</a></p>
    `,
  });
}

// New-post notification. `communityName` is set when the recipient is being
// notified as a community member; null means they're notified as a friend of
// the author.
export async function sendNewPostEmail(
  to: string,
  authorName: string,
  postTitle: string,
  postId: string,
  communityName: string | null,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping new-post email to ${to}`,
    );
    return;
  }

  const postUrl = `${env.CLIENT_URL}/posts/${postId}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedAuthor = escape(authorName);
  const escapedTitle = escape(postTitle);

  if (communityName !== null) {
    const escapedCommunity = escape(communityName);
    await t.sendMail({
      from,
      to,
      subject: `New post in ${communityName}: "${postTitle}"`,
      text: `${authorName} posted "${postTitle}" in ${communityName} on Mayday.\n\nView the post: ${postUrl}`,
      html: `
        <p><strong>${escapedAuthor}</strong> posted <strong>"${escapedTitle}"</strong> in <strong>${escapedCommunity}</strong> on Mayday.</p>
        <p><a href="${postUrl}">View the post</a></p>
      `,
    });
    return;
  }

  await t.sendMail({
    from,
    to,
    subject: `${authorName} shared a new post: "${postTitle}"`,
    text: `Your friend ${authorName} shared the post "${postTitle}" on Mayday.\n\nView the post: ${postUrl}`,
    html: `
      <p>Your friend <strong>${escapedAuthor}</strong> shared the post <strong>"${escapedTitle}"</strong> on Mayday.</p>
      <p><a href="${postUrl}">View the post</a></p>
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
    console.warn(
      `[mail] SMTP not configured; skipping community-join-request email to ${to}`,
    );
    return;
  }

  const requestsUrl = `${env.CLIENT_URL}/communities/${communityId}/manage`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedRequester = escape(requesterName);
  const escapedCommunity = escape(communityName);
  const messageBlockHtml = requestMessage
    ? `<p>They wrote:</p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escape(requestMessage)}</blockquote>`
    : "";
  const messageBlockText = requestMessage
    ? `\n\nThey wrote:\n"${requestMessage}"`
    : "";

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

export async function sendCommunityJoinRequestApprovedEmail(
  to: string,
  communityName: string,
  communityId: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping community-join-approved email to ${to}`,
    );
    return;
  }

  const communityUrl = `${env.CLIENT_URL}/communities/${communityId}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedCommunity = escape(communityName);

  await t.sendMail({
    from,
    to,
    subject: `You're in: ${communityName} on Mayday`,
    text: `Your request to join the "${communityName}" community on Mayday was approved.\n\nVisit the community: ${communityUrl}`,
    html: `
      <p>Your request to join the <strong>${escapedCommunity}</strong> community on Mayday was approved.</p>
      <p><a href="${communityUrl}">Visit the community</a></p>
    `,
  });
}

export async function sendCommunityInviteEmail(
  to: string,
  inviterName: string,
  communityName: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping community-invite email to ${to}`,
    );
    return;
  }

  const messagesUrl = `${env.CLIENT_URL}/messages`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedInviter = escape(inviterName);
  const escapedCommunity = escape(communityName);

  await t.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${communityName} on Mayday`,
    text: `${inviterName} invited you to join the "${communityName}" community on Mayday.\n\nView the invitation in your messages: ${messagesUrl}`,
    html: `
      <p><strong>${escapedInviter}</strong> invited you to join the <strong>${escapedCommunity}</strong> community on Mayday.</p>
      <p><a href="${messagesUrl}">View the invitation in your messages</a></p>
    `,
  });
}

export async function sendOrganizationInviteEmail(
  to: string,
  inviterName: string,
  organizationName: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping organization-invite email to ${to}`,
    );
    return;
  }

  const messagesUrl = `${env.CLIENT_URL}/messages`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedInviter = escape(inviterName);
  const escapedOrg = escape(organizationName);

  await t.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${organizationName} on Mayday`,
    text: `${inviterName} invited you to join the "${organizationName}" organization on Mayday.\n\nView the invitation in your messages: ${messagesUrl}`,
    html: `
      <p><strong>${escapedInviter}</strong> invited you to join the <strong>${escapedOrg}</strong> organization on Mayday.</p>
      <p><a href="${messagesUrl}">View the invitation in your messages</a></p>
    `,
  });
}

export async function sendFriendRequestEmail(
  to: string,
  senderName: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping friend-request email to ${to}`,
    );
    return;
  }

  const messagesUrl = `${env.CLIENT_URL}/messages`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedSender = escape(senderName);

  await t.sendMail({
    from,
    to,
    subject: `${senderName} sent you a friend request on Mayday`,
    text: `${senderName} sent you a friend request on Mayday.\n\nAccept or decline it in your messages: ${messagesUrl}`,
    html: `
      <p><strong>${escapedSender}</strong> sent you a friend request on Mayday.</p>
      <p><a href="${messagesUrl}">Accept or decline it in your messages</a></p>
    `,
  });
}

export async function sendFriendRequestAcceptedEmail(
  to: string,
  accepterName: string,
  accepterId: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping friend-accepted email to ${to}`,
    );
    return;
  }

  const profileUrl = `${env.CLIENT_URL}/profile/${accepterId}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedAccepter = escape(accepterName);

  await t.sendMail({
    from,
    to,
    subject: `${accepterName} accepted your friend request on Mayday`,
    text: `${accepterName} accepted your friend request. You're now friends on Mayday.\n\nView their profile: ${profileUrl}`,
    html: `
      <p><strong>${escapedAccepter}</strong> accepted your friend request. You're now friends on Mayday.</p>
      <p><a href="${profileUrl}">View their profile</a></p>
    `,
  });
}

export async function sendCommunitySignupInviteEmail(
  to: string,
  inviterName: string,
  communityName: string,
  claimToken: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping community-signup-invite email to ${to}`,
    );
    return;
  }

  const registerUrl = `${env.CLIENT_URL}/register?email=${encodeURIComponent(to)}&claimToken=${encodeURIComponent(claimToken)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedInviter = escape(inviterName);
  const escapedCommunity = escape(communityName);

  await t.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${communityName} on Mayday`,
    text: `${inviterName} invited you to join the "${communityName}" community on Mayday, but you don't have an account yet.\n\nCreate an account to accept the invite:\n${registerUrl}\n\nOnce you've signed up and confirmed your email, your invite will be waiting in your inbox.`,
    html: `
      <p><strong>${escapedInviter}</strong> invited you to join the <strong>${escapedCommunity}</strong> community on Mayday, but you don't have an account yet.</p>
      <p><a href="${registerUrl}">Create your account</a></p>
      <p style="color:#666;font-size:0.9em;">Once you've signed up and confirmed your email, your invite will be waiting in your inbox.</p>
    `,
  });
}

export async function sendOrganizationSignupInviteEmail(
  to: string,
  inviterName: string,
  organizationName: string,
  claimToken: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping organization-signup-invite email to ${to}`,
    );
    return;
  }

  const registerUrl = `${env.CLIENT_URL}/register?email=${encodeURIComponent(to)}&claimToken=${encodeURIComponent(claimToken)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedInviter = escape(inviterName);
  const escapedOrg = escape(organizationName);

  await t.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${organizationName} on Mayday`,
    text: `${inviterName} invited you to join the "${organizationName}" organization on Mayday, but you don't have an account yet.\n\nCreate an account to accept the invite:\n${registerUrl}\n\nOnce you've signed up and confirmed your email, your invite will be waiting in your inbox.`,
    html: `
      <p><strong>${escapedInviter}</strong> invited you to join the <strong>${escapedOrg}</strong> organization on Mayday, but you don't have an account yet.</p>
      <p><a href="${registerUrl}">Create your account</a></p>
      <p style="color:#666;font-size:0.9em;">Once you've signed up and confirmed your email, your invite will be waiting in your inbox.</p>
    `,
  });
}

export async function sendAnnouncementEmail(
  to: string,
  recipientName: string,
  message: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping announcement email to ${to}`,
    );
    return;
  }

  const settingsUrl = `${env.CLIENT_URL}/`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedName = escape(recipientName);
  const escapedMessage = escape(message);

  await t.sendMail({
    from,
    to,
    subject: "Announcement from Mayday",
    text: `Hi ${recipientName},\n\n${message}\n\n— The Mayday team\n\nYou received this email because announcements are enabled on your account. To stop receiving these, turn off email notifications in your profile: ${settingsUrl}`,
    html: `
      <p>Hi ${escapedName},</p>
      <p style="white-space:pre-wrap;">${escapedMessage}</p>
      <p>— Mark @ MayDay</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#888;font-size:0.85em;">You received this email because announcements are enabled on your account. To stop receiving these, turn off email notifications in your <a href="${settingsUrl}">Mayday profile</a>.</p>
    `,
  });
}

export async function sendBugReportAdminEmail(
  to: string,
  reporterName: string,
  title: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping bug-report admin email to ${to}`,
    );
    return;
  }

  const adminUrl = `${env.CLIENT_URL}/admin`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedReporter = escape(reporterName);
  const escapedTitle = escape(title);

  await t.sendMail({
    from,
    to,
    subject: `New bug report from ${reporterName}: ${title}`,
    text: `${reporterName} submitted a new bug report on Mayday:\n\n"${title}"\n\nReview it in the admin console: ${adminUrl}`,
    html: `
      <p><strong>${escapedReporter}</strong> submitted a new bug report on Mayday:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escapedTitle}</blockquote>
      <p><a href="${adminUrl}">Review it in the admin console</a></p>
    `,
  });
}

export async function sendUserReportAdminEmail(
  to: string,
  reporterName: string,
  reason: string,
  targetKind: 'user' | 'content',
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping ${targetKind}-report admin email to ${to}`,
    );
    return;
  }

  const adminUrl = `${env.CLIENT_URL}/admin`;
  const from = env.SMTP_FROM || env.SMTP_USER!;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedReporter = escape(reporterName);
  const escapedReason = escape(reason);
  const subjectKind = targetKind === 'user' ? 'user report' : 'content report';

  await t.sendMail({
    from,
    to,
    subject: `New ${subjectKind} from ${reporterName}: ${reason}`,
    text: `${reporterName} submitted a new ${subjectKind} on Mayday:\n\n"${reason}"\n\nReview it in the admin console: ${adminUrl}`,
    html: `
      <p><strong>${escapedReporter}</strong> submitted a new ${subjectKind} on Mayday:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444;">${escapedReason}</blockquote>
      <p><a href="${adminUrl}">Review it in the admin console</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mail] SMTP not configured; skipping password reset email to ${to}`,
    );
    return;
  }

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const from = env.SMTP_FROM || env.SMTP_USER!;

  await t.sendMail({
    from,
    to,
    subject: "Reset your Mayday password",
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
