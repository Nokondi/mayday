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
  page?: number;
  limit?: number;
  sort?: 'recent' | 'urgency';
}
