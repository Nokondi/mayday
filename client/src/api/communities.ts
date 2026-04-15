import type {
  CreateCommunityRequest,
  UpdateCommunityRequest,
  InviteToCommunityRequest,
  UpdateMemberRoleRequest,
  CommunityJoinRequestInput,
  Community,
  CommunityDetail,
  CommunityMember,
  CommunityInvite,
  CommunityJoinRequest,
  CommunityWithMembership,
  PaginatedResponse,
} from '@mayday/shared';
import { api } from './client.js';

export async function listCommunities(params?: { q?: string; page?: number; limit?: number }): Promise<PaginatedResponse<CommunityWithMembership>> {
  const res = await api.get('/communities', { params });
  return res.data;
}

export async function listMyCommunities(): Promise<CommunityWithMembership[]> {
  const res = await api.get('/communities/mine');
  return res.data;
}

export async function getCommunity(id: string): Promise<CommunityDetail> {
  const res = await api.get(`/communities/${id}`);
  return res.data;
}

export async function createCommunity(data: CreateCommunityRequest): Promise<CommunityWithMembership> {
  const res = await api.post('/communities', data);
  return res.data;
}

export async function updateCommunity(id: string, data: UpdateCommunityRequest): Promise<Community> {
  const res = await api.patch(`/communities/${id}`, data);
  return res.data;
}

export async function uploadCommunityAvatar(id: string, file: File): Promise<Community> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await api.post(`/communities/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteCommunity(id: string): Promise<void> {
  await api.delete(`/communities/${id}`);
}

// Members
export async function getCommunityMembers(id: string): Promise<CommunityMember[]> {
  const res = await api.get(`/communities/${id}/members`);
  return res.data;
}

export async function updateCommunityMemberRole(communityId: string, userId: string, data: UpdateMemberRoleRequest): Promise<CommunityMember> {
  const res = await api.patch(`/communities/${communityId}/members/${userId}`, data);
  return res.data;
}

export async function removeCommunityMember(communityId: string, userId: string): Promise<void> {
  await api.delete(`/communities/${communityId}/members/${userId}`);
}

// Invites (community-side)
export async function getCommunityInvites(id: string): Promise<CommunityInvite[]> {
  const res = await api.get(`/communities/${id}/invites`);
  return res.data;
}

export async function inviteToCommunity(id: string, data: InviteToCommunityRequest): Promise<CommunityInvite> {
  const res = await api.post(`/communities/${id}/invites`, data);
  return res.data;
}

export async function revokeCommunityInvite(communityId: string, inviteId: string): Promise<void> {
  await api.delete(`/communities/${communityId}/invites/${inviteId}`);
}

// Invites (user-side)
export async function getMyCommunityInvites(): Promise<CommunityInvite[]> {
  const res = await api.get('/communities/me/invites');
  return res.data;
}

export async function acceptCommunityInvite(inviteId: string): Promise<void> {
  await api.post(`/communities/me/invites/${inviteId}/accept`);
}

export async function declineCommunityInvite(inviteId: string): Promise<void> {
  await api.post(`/communities/me/invites/${inviteId}/decline`);
}

// Join requests (user-side)
export async function requestToJoinCommunity(id: string, data?: CommunityJoinRequestInput): Promise<CommunityJoinRequest> {
  const res = await api.post(`/communities/${id}/join-requests`, data ?? {});
  return res.data;
}

export async function withdrawJoinRequest(id: string): Promise<void> {
  await api.delete(`/communities/${id}/join-requests`);
}

// Join requests (community-side)
export async function getCommunityJoinRequests(id: string): Promise<CommunityJoinRequest[]> {
  const res = await api.get(`/communities/${id}/join-requests`);
  return res.data;
}

export async function approveJoinRequest(communityId: string, requestId: string): Promise<void> {
  await api.post(`/communities/${communityId}/join-requests/${requestId}/approve`);
}

export async function rejectJoinRequest(communityId: string, requestId: string): Promise<void> {
  await api.post(`/communities/${communityId}/join-requests/${requestId}/reject`);
}
