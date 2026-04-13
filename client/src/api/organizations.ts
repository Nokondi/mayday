import type {
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  InviteToOrganizationRequest,
  UpdateMemberRoleRequest,
  Organization,
  OrganizationDetail,
  OrganizationMember,
  OrganizationInvite,
  OrganizationWithMembership,
  PaginatedResponse,
} from '@mayday/shared';
import { api } from './client.js';

export async function listOrganizations(params?: { q?: string; page?: number; limit?: number }): Promise<PaginatedResponse<OrganizationWithMembership>> {
  const res = await api.get('/organizations', { params });
  return res.data;
}

export async function listMyOrganizations(): Promise<OrganizationWithMembership[]> {
  const res = await api.get('/organizations/mine');
  return res.data;
}

export async function getOrganization(id: string): Promise<OrganizationDetail> {
  const res = await api.get(`/organizations/${id}`);
  return res.data;
}

export async function createOrganization(data: CreateOrganizationRequest): Promise<OrganizationWithMembership> {
  const res = await api.post('/organizations', data);
  return res.data;
}

export async function updateOrganization(id: string, data: UpdateOrganizationRequest): Promise<Organization> {
  const res = await api.patch(`/organizations/${id}`, data);
  return res.data;
}

export async function deleteOrganization(id: string): Promise<void> {
  await api.delete(`/organizations/${id}`);
}

// Members
export async function getOrganizationMembers(id: string): Promise<OrganizationMember[]> {
  const res = await api.get(`/organizations/${id}/members`);
  return res.data;
}

export async function updateMemberRole(orgId: string, userId: string, data: UpdateMemberRoleRequest): Promise<OrganizationMember> {
  const res = await api.patch(`/organizations/${orgId}/members/${userId}`, data);
  return res.data;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await api.delete(`/organizations/${orgId}/members/${userId}`);
}

// Invites (org-side)
export async function getOrganizationInvites(id: string): Promise<OrganizationInvite[]> {
  const res = await api.get(`/organizations/${id}/invites`);
  return res.data;
}

export async function inviteToOrganization(id: string, data: InviteToOrganizationRequest): Promise<OrganizationInvite> {
  const res = await api.post(`/organizations/${id}/invites`, data);
  return res.data;
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  await api.delete(`/organizations/${orgId}/invites/${inviteId}`);
}

// Invites (user-side)
export async function getMyInvites(): Promise<OrganizationInvite[]> {
  const res = await api.get('/organizations/me/invites');
  return res.data;
}

export async function acceptInvite(inviteId: string): Promise<void> {
  await api.post(`/organizations/me/invites/${inviteId}/accept`);
}

export async function declineInvite(inviteId: string): Promise<void> {
  await api.post(`/organizations/me/invites/${inviteId}/decline`);
}
