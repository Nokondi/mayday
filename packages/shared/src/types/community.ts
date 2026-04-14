import type { UserPublicProfile } from './user.js';
import type { OrgRole, InviteStatus } from './organization.js';

export type CommunityRole = OrgRole;
export type CommunityInviteStatus = InviteStatus;

export interface Community {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityRole;
  joinedAt: string;
  user: UserPublicProfile;
}

export type CommunityJoinRequestStatus = InviteStatus;

export interface CommunityJoinRequest {
  id: string;
  communityId: string;
  userId: string;
  status: CommunityJoinRequestStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  community?: Community;
  user?: UserPublicProfile;
}

export interface CommunityWithMembership extends Community {
  memberCount: number;
  myRole: CommunityRole | null;
  myJoinRequestStatus: CommunityJoinRequestStatus | null;
}

export interface CommunityDetail extends CommunityWithMembership {
  members: CommunityMember[];
}

export interface CommunityInvite {
  id: string;
  communityId: string;
  invitedUserId: string;
  invitedById: string;
  status: CommunityInviteStatus;
  createdAt: string;
  updatedAt: string;
  community?: Community;
  invitedUser?: UserPublicProfile;
  invitedBy: UserPublicProfile;
}
