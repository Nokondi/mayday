import type { ProfileLink } from './api.js';
import type { FriendStatus } from './friendship.js';
import type { NotificationCategory } from './notification.js';

export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  skills: string[];
  avatarUrl: string | null;
  links: ProfileLink[] | null;
  role: Role;
  isBanned: boolean;
  pushNotificationsEnabled: boolean;
  mutedEmailCategories: NotificationCategory[];
  mutedPushCategories: NotificationCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPublicProfile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  skills: string[];
  avatarUrl: string | null;
  links: ProfileLink[] | null;
  createdAt: string;
  fulfilledCount?: number;
  // Set on the GET /users/:id detail response when a logged-in viewer requests
  // another user's profile. Drives the profile friend button. Absent for the
  // viewer's own profile and for anonymous requests.
  friendStatus?: FriendStatus;
  // The relevant FriendRequest id: the incoming request when REQUEST_RECEIVED
  // (to accept/decline), or the outgoing request when REQUEST_SENT (to cancel).
  friendRequestId?: string | null;
}
