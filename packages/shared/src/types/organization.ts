import type { UserPublicProfile } from './user.js';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

export interface Organization {
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

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  joinedAt: string;
  user: UserPublicProfile;
}

export interface OrganizationWithMembership extends Organization {
  memberCount: number;
  /** Current user's role in this org, if they're a member. */
  myRole: OrgRole | null;
}

export interface OrganizationDetail extends OrganizationWithMembership {
  members: OrganizationMember[];
}

export interface OrganizationInvite {
  id: string;
  organizationId: string;
  invitedUserId: string;
  invitedById: string;
  status: InviteStatus;
  createdAt: string;
  updatedAt: string;
  /** Present on user-side invites (`/me/invites`) */
  organization?: Organization;
  /** Present on org-side invites (`/organizations/:id/invites`) */
  invitedUser?: UserPublicProfile;
  invitedBy: UserPublicProfile;
}
