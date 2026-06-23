import type { UserPublicProfile } from './user.js';
import type { InviteStatus } from './organization.js';

// The current user's friend relationship with another user, as surfaced on that
// user's public profile so the friend button can render the right action.
export type FriendStatus =
  | 'NONE' // no friendship and no pending request
  | 'REQUEST_SENT' // current user has a pending outgoing request
  | 'REQUEST_RECEIVED' // current user has a pending incoming request
  | 'FRIENDS'; // already friends

// A pending incoming friend request, as listed for the recipient.
export interface FriendRequest {
  id: string;
  status: InviteStatus;
  createdAt: string;
  sender: UserPublicProfile;
}
