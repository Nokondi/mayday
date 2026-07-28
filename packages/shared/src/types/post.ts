import type { Category } from './category.js';
import type { UserPublicProfile } from './user.js';
import type { Organization } from './organization.js';
import type { Community } from './community.js';

export type PostType = 'REQUEST' | 'OFFER' | 'EVENT';
export type PostStatus = 'OPEN' | 'FULFILLED' | 'CLOSED';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RecurrenceFrequency = 'DAY' | 'WEEK' | 'MONTH';

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
  // Visible to members of any of its communities, plus the author's friends
  // when true. No communities and false ⇒ public.
  sharedWithFriends: boolean;
  title: string;
  description: string;
  category: Category;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  urgency: UrgencyLevel;
  authorId: string;
  organizationId: string | null;
  startAt: string | null;
  endAt: string | null;
  recurrenceFreq: RecurrenceFrequency | null;
  recurrenceInterval: number | null;
  images: PostImage[];
  fulfillments: PostFulfillment[];
  // Number of comments on the post (live count; comments are hard-deleted so
  // there are no tombstones to exclude). Drives the PostCard comment counter.
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostWithAuthor extends Post {
  author: UserPublicProfile;
  organization: Pick<Organization, 'id' | 'name' | 'avatarUrl'> | null;
  communities: Pick<Community, 'id' | 'name'>[];
}
