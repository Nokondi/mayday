import { z } from 'zod';
import { CATEGORIES } from './category.js';
import { NOTIFICATION_CATEGORIES } from './notification.js';

// Auth
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Missing reset token'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ResendVerificationRequest = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl: string | null;
  };
}

// Posts
// Accept "" (empty input), undefined, or a datetime-parseable string. Output is ISO string or undefined.
const optionalDateTime = z
  .string()
  .optional()
  .transform((v) => (v === '' || v == null ? undefined : v))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), { message: 'Invalid date/time' });

const postFields = {
  type: z.enum(['REQUEST', 'OFFER', 'EVENT']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  organizationId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  // When true, the post is also visible to the author's friends. Combines with
  // communityIds (union audience). Accepts a real boolean or the "true"/"false"
  // strings multipart form-data sends.
  sharedWithFriends: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .optional(),
  // Communities the post is scoped to. Members of ANY listed community can see
  // it. Accepts a single id (multipart sends one field as a string) or an array,
  // and drops empties. No communities and sharedWithFriends=false ⇒ public.
  communityIds: z
    .preprocess(
      (v) => (v === '' || v == null ? undefined : Array.isArray(v) ? v : [v]),
      z.array(z.string().uuid()).max(20),
    )
    .optional(),
  startAt: optionalDateTime,
  endAt: optionalDateTime,
  recurrenceFreq: z
    .enum(['DAY', 'WEEK', 'MONTH'])
    .optional()
    .or(z.literal('').transform(() => undefined)),
  recurrenceInterval: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(365).optional(),
  ),
};

type PostFieldsData = {
  type?: 'REQUEST' | 'OFFER' | 'EVENT';
  startAt?: string;
  endAt?: string;
  recurrenceFreq?: 'DAY' | 'WEEK' | 'MONTH';
  recurrenceInterval?: number;
};

function checkPostFields(data: PostFieldsData, ctx: z.RefinementCtx) {
  if (data.startAt && data.endAt && new Date(data.endAt) < new Date(data.startAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End must be after start', path: ['endAt'] });
  }
  // Events must be schedulable — a start date is what makes them events. Only
  // enforced when `type` is present so partial updates that don't touch the
  // type stay valid.
  if (data.type === 'EVENT' && !data.startAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Events need a start date', path: ['startAt'] });
  }
  if (data.recurrenceFreq && data.recurrenceInterval == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Interval is required for recurring posts', path: ['recurrenceInterval'] });
  }
  if (data.recurrenceInterval != null && !data.recurrenceFreq) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Frequency is required for recurring posts', path: ['recurrenceFreq'] });
  }
  if (data.recurrenceFreq && !data.startAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Recurring posts need a start date', path: ['startAt'] });
  }
}

export const createPostSchema = z.object(postFields).superRefine(checkPostFields);

export const updatePostSchema = z
  .object(postFields)
  .partial()
  .extend({ status: z.enum(['OPEN', 'FULFILLED', 'CLOSED']).optional() })
  .superRefine(checkPostFields);

export const fulfillPostSchema = z.object({
  fulfillers: z.array(z.object({
    name: z.string().min(1, 'Name is required').max(100),
    userId: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
  })).min(1, 'At least one fulfiller is required').max(20),
});

export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostSchema>;
export type FulfillPostRequest = z.infer<typeof fulfillPostSchema>;

// Comments — create and edit share the same body-only shape.
export const createCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(2000),
});
export const updateCommentSchema = createCommentSchema;

export type CreateCommentRequest = z.infer<typeof createCommentSchema>;
export type UpdateCommentRequest = z.infer<typeof updateCommentSchema>;

// Profile links — shared by users, organizations, and communities.
// Stored as a JSON array column. An empty array is normalized to undefined by callers.
export const profileLinkSchema = z.object({
  label: z.string().max(50).optional(),
  url: z.string().url('Enter a valid URL').max(500),
});

export const profileLinksSchema = z.array(profileLinkSchema).max(20).optional();

export type ProfileLink = z.infer<typeof profileLinkSchema>;

// User profile
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  links: profileLinksSchema,
});

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

// User settings (private — not exposed via public profile)
export const updateUserSettingsSchema = z.object({
  pushNotificationsEnabled: z.boolean().optional(),
  // Full-list semantics: each write replaces the muted set for that channel.
  mutedEmailCategories: z.array(z.enum(NOTIFICATION_CATEGORIES)).max(NOTIFICATION_CATEGORIES.length).optional(),
  mutedPushCategories: z.array(z.enum(NOTIFICATION_CATEGORIES)).max(NOTIFICATION_CATEGORIES.length).optional(),
  notifyFriendPosts: z.boolean().optional(),
  notifyCommunityPosts: z.boolean().optional(),
  minPostNotificationUrgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  postNotificationFrequency: z.enum(['IMMEDIATE', 'WEEKLY']).optional(),
});

export type UpdateUserSettingsRequest = z.infer<typeof updateUserSettingsSchema>;

// Push notifications — subscription registration. Shape mirrors the JSON
// returned by PushSubscription.toJSON() in the browser.
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  userAgent: z.string().max(512).optional(),
});

// Subscription rotation from the service worker's pushsubscriptionchange
// handler. No JWT is available in that context — possession of the old
// endpoint (an unguessable capability URL) is the credential.
export const pushResubscribeSchema = z.object({
  oldEndpoint: z.string().url().max(2048),
  subscription: pushSubscribeSchema,
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export type PushSubscribeRequest = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribeRequest = z.infer<typeof pushUnsubscribeSchema>;
export type PushResubscribeRequest = z.infer<typeof pushResubscribeSchema>;

// E2EE devices — keys are base64-encoded raw bytes. The 44-char length cap
// fits a base64-encoded 32-byte key (Ed25519/X25519 public keys); the signature
// is 64 bytes → 88 chars base64. Bounds are deliberately tight so a malformed
// or oversized blob is rejected before we touch the database.
const base64Key = z.string().regex(/^[A-Za-z0-9+/]+=*$/, 'Must be base64').min(43).max(44);
const base64Sig = z.string().regex(/^[A-Za-z0-9+/]+=*$/, 'Must be base64').min(86).max(88);

export const registerDeviceSchema = z.object({
  signingPublicKey: base64Key,
  encryptionPublicKey: base64Key,
  encryptionKeySig: base64Sig,
  label: z.string().max(120).optional(),
});

export type RegisterDeviceRequest = z.infer<typeof registerDeviceSchema>;

// Messages
// E2EE envelope used as the alternative payload shape when sending an
// encrypted message. ciphertext/nonce are base64 sodium outputs; the
// senderDeviceId identifies which of the sender's devices produced this.
// protocolVersion lets us migrate to Level B (Double Ratchet) later without
// breaking clients that only know protocolVersion=1.
const base64Bytes = z.string().regex(/^[A-Za-z0-9+/]+=*$/, 'Must be base64');
export const encryptedEnvelopeSchema = z.object({
  protocolVersion: z.literal(1),
  ciphertext: base64Bytes.min(1).max(8192),
  nonce: base64Bytes.min(32).max(36),
  senderDeviceId: z.string().uuid(),
  keyEpoch: z.number().int().min(1).max(1_000_000),
});
export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>;

// A send/start payload is either a plaintext content string OR an envelope.
// The server stores whichever shape arrives; clients fall back to plaintext
// when they can't encrypt (peer has no device yet, E2EE flag is off, etc.).
const messageBodySchema = z.union([
  z.object({ content: z.string().min(1, 'Message cannot be empty').max(5000) }),
  z.object({ envelope: encryptedEnvelopeSchema }),
]);

export const sendMessageSchema = messageBodySchema;

// startConversation accepts either `{ message }` (plaintext, pre-Phase-2
// shape preserved for backwards compatibility with existing clients) or
// `{ envelope }` (Phase 2 encrypted send). Both are optional — you can
// also start an empty conversation with no first message.
//
// Branch order matters: the `message` branch makes `message` optional, so
// it matches almost any body containing `participantId`. Putting the
// `envelope` branch first ensures encrypted bodies don't get silently
// classified as the plaintext shape and have their envelope field stripped.
export const startConversationSchema = z.intersection(
  z.object({ participantId: z.string().uuid() }),
  z.union([
    z.object({ envelope: encryptedEnvelopeSchema }),
    z.object({ message: z.string().min(1).max(5000).optional() }),
  ]),
);

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type StartConversationRequest = z.infer<typeof startConversationSchema>;

// Conversation key wraps — clients upload a CK sealed to each recipient
// device's X25519 public key. The server validates that each deviceId
// belongs to a participant of the conversation but cannot read the wrap.
export const uploadKeyWrapsSchema = z.object({
  wraps: z
    .array(z.object({
      deviceId: z.string().uuid(),
      wrappedKey: base64Bytes.min(1).max(256),
      keyEpoch: z.number().int().min(1).max(1_000_000),
    }))
    .min(1)
    .max(50),
});

export type UploadKeyWrapsRequest = z.infer<typeof uploadKeyWrapsSchema>;

// Reports
export const createReportSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(200),
  details: z.string().max(2000).optional(),
  reportedUserId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
});

export type CreateReportRequest = z.infer<typeof createReportSchema>;

export const reportUserSchema = z.object({
  email: z.string().email(),
  reason: z.string().min(1, 'Reason is required').max(200),
  details: z.string().max(2000).optional(),
});

export type ReportUserRequest = z.infer<typeof reportUserSchema>;

// Bug Reports
export const createBugReportSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
});

export const updateBugReportSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

export type CreateBugReportRequest = z.infer<typeof createBugReportSchema>;
export type UpdateBugReportRequest = z.infer<typeof updateBugReportSchema>;

// Organizations
// Avatar is set via the dedicated upload endpoint (POST /api/organizations/:id/avatar),
// not as part of create/update — same pattern as user avatars.
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  links: profileLinksSchema,
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const inviteToOrganizationSchema = z.object({
  email: z.string().email(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

// Friends — send a request to another user by id.
export const sendFriendRequestSchema = z.object({
  userId: z.string().uuid(),
});

export type SendFriendRequestRequest = z.infer<typeof sendFriendRequestSchema>;

export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationSchema>;
export type InviteToOrganizationRequest = z.infer<typeof inviteToOrganizationSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipRequest = z.infer<typeof transferOwnershipSchema>;

// Account deletion — optional heir assignments per owned community/org.
// Maps are `<communityId|organizationId, newOwnerUserId>`. Any owned group
// omitted from the map falls back to the server's auto-pick (oldest ADMIN,
// else oldest MEMBER); solo-owner groups are deleted regardless.
export const deleteAccountSchema = z.object({
  communityHeirs: z.record(z.string().uuid(), z.string().uuid()).optional(),
  organizationHeirs: z.record(z.string().uuid(), z.string().uuid()).optional(),
});

export type DeleteAccountRequest = z.infer<typeof deleteAccountSchema>;

// Snapshot of communities/orgs the current user owns, used by the
// account-delete picker UI. `candidates` is empty when the user is the sole
// member, in which case the group is deleted on account removal.
export interface OwnedGroupHeirCandidate {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
}

export interface OwnedGroupSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Member who would inherit if no heir is selected. `null` when solo-owned. */
  defaultHeirUserId: string | null;
  candidates: OwnedGroupHeirCandidate[];
}

export interface OwnedGroupsResponse {
  communities: OwnedGroupSummary[];
  organizations: OwnedGroupSummary[];
}

// Communities
// Avatar is set via the dedicated upload endpoint (POST /api/communities/:id/avatar),
// not as part of create/update — same pattern as user avatars.
export const createCommunitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  links: profileLinksSchema,
});

export const updateCommunitySchema = createCommunitySchema.partial();

export const inviteToCommunitySchema = z.object({
  email: z.string().email(),
});

export const communityJoinRequestSchema = z.object({
  message: z.string().max(500).optional(),
});

// Per-community new-post notification opt-out (updates the caller's own
// membership row).
export const updateCommunityNotificationsSchema = z.object({
  notifyNewPosts: z.boolean(),
});

export type CreateCommunityRequest = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityRequest = z.infer<typeof updateCommunitySchema>;
export type InviteToCommunityRequest = z.infer<typeof inviteToCommunitySchema>;
export type CommunityJoinRequestInput = z.infer<typeof communityJoinRequestSchema>;
export type UpdateCommunityNotificationsRequest = z.infer<typeof updateCommunityNotificationsSchema>;

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Post query params
export interface PostQueryParams {
  type?: 'REQUEST' | 'OFFER' | 'EVENT';
  category?: string;
  status?: 'OPEN' | 'FULFILLED' | 'CLOSED';
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  q?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  neLat?: number;
  neLng?: number;
  swLat?: number;
  swLng?: number;
  communityId?: string;
  // Narrow the feed to posts shared with the viewer by their friends.
  friends?: boolean;
  scheduled?: boolean;
  page?: number;
  limit?: number;
  sort?: 'recent' | 'urgency';
}
