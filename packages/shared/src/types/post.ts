import type { Category } from './category.js';
import type { UserPublicProfile } from './user.js';
import type { Organization } from './organization.js';
import type { Community } from './community.js';

export type PostType = 'REQUEST' | 'OFFER';
export type PostStatus = 'OPEN' | 'FULFILLED' | 'CLOSED';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PostImage {
  id: string;
  url: string;
  order: number;
}

export interface PostFulfillment {
  id: string;
  postId: string;
  name: string;
  userId: string | null;
  organizationId: string | null;
  createdAt: string;
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
  communityId: string | null;
  images: PostImage[];
  fulfillments: PostFulfillment[];
  createdAt: string;
  updatedAt: string;
}

export interface PostWithAuthor extends Post {
  author: UserPublicProfile;
  organization: Pick<Organization, 'id' | 'name' | 'avatarUrl'> | null;
  community: Pick<Community, 'id' | 'name'> | null;
}
