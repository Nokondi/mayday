import type { PaginatedResponse } from '@mayday/shared';
import { api } from './client.js';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

interface AdminUserSearchParams {
  q?: string;
  role?: 'USER' | 'ADMIN';
  banned?: boolean;
  page?: number;
  limit?: number;
}

export async function searchUsers(params: AdminUserSearchParams = {}): Promise<PaginatedResponse<AdminUserRow>> {
  const query: Record<string, string | number> = {};
  if (params.q) query.q = params.q;
  if (params.role) query.role = params.role;
  if (params.banned !== undefined) query.banned = String(params.banned);
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const res = await api.get('/admin/users', { params: query });
  return res.data;
}

export async function setUserBanned(id: string, banned: boolean): Promise<void> {
  await api.put(`/admin/users/${id}/ban`, { banned });
}
