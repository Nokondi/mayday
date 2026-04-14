import { z } from 'zod';
import { CATEGORIES } from './category.js';

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

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

// Posts
export const createPostSchema = z.object({
  type: z.enum(['REQUEST', 'OFFER']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.enum(CATEGORIES),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  organizationId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  communityId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
});

export const updatePostSchema = createPostSchema.partial().extend({
  status: z.enum(['OPEN', 'FULFILLED', 'CLOSED']).optional(),
});

export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostSchema>;

// User profile
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

// Messages
export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000),
});

export const startConversationSchema = z.object({
  participantId: z.string().uuid(),
  message: z.string().min(1).max(5000).optional(),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
export type StartConversationRequest = z.infer<typeof startConversationSchema>;

// Reports
export const createReportSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(200),
  details: z.string().max(2000).optional(),
  reportedUserId: z.string().uuid().optional(),
  postId: z.string().uuid().optional(),
});

export type CreateReportRequest = z.infer<typeof createReportSchema>;

// Organizations
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Accept empty string as "not provided" so a blank optional input doesn't fail URL validation
  avatarUrl: z
    .string()
    .max(500)
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const inviteToOrganizationSchema = z.object({
  email: z.string().email(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationSchema>;
export type InviteToOrganizationRequest = z.infer<typeof inviteToOrganizationSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;

// Communities
export const createCommunitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  avatarUrl: z
    .string()
    .max(500)
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const updateCommunitySchema = createCommunitySchema.partial();

export const inviteToCommunitySchema = z.object({
  email: z.string().email(),
});

export const communityJoinRequestSchema = z.object({
  message: z.string().max(500).optional(),
});

export type CreateCommunityRequest = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityRequest = z.infer<typeof updateCommunitySchema>;
export type InviteToCommunityRequest = z.infer<typeof inviteToCommunitySchema>;
export type CommunityJoinRequestInput = z.infer<typeof communityJoinRequestSchema>;

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
  type?: 'REQUEST' | 'OFFER';
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
  page?: number;
  limit?: number;
  sort?: 'recent' | 'urgency';
}
