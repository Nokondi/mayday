import type { Category } from './category.js';
import type { UserPublicProfile } from './user.js';
import type { Organization } from './organization.js';

export type PostType = 'REQUEST' | 'OFFER';
export type PostStatus = 'OPEN' | 'FULFILLED' | 'CLOSED';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PostImage {
  id: string;
  url: string;
  order: number;
}

export interface Post {
  id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  description: string;
  category: Category;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: UrgencyLevel;
  authorId: string;
  organizationId: string | null;
  images: PostImage[];
  createdAt: string;
  updatedAt: string;
}

export interface PostWithAuthor extends Post {
  author: UserPublicProfile;
  organization: Pick<Organization, 'id' | 'name' | 'avatarUrl'> | null;
}
