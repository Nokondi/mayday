import type { UserPublicProfile, UpdateProfileRequest, PaginatedResponse, PostWithAuthor } from '@mayday/shared';
import { api } from './client.js';

export async function getUser(id: string): Promise<UserPublicProfile> {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function updateProfile(id: string, data: UpdateProfileRequest) {
  const res = await api.put(`/users/${id}`, data);
  return res.data;
}

export async function uploadUserAvatar(id: string, file: File): Promise<UserPublicProfile> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await api.post(`/users/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getUserPosts(id: string, page = 1): Promise<PaginatedResponse<PostWithAuthor>> {
  const res = await api.get(`/users/${id}/posts`, { params: { page } });
  return res.data;
}

export async function createReport(data: { reason: string; details?: string; reportedUserId?: string; postId?: string }) {
  const res = await api.post('/reports', data);
  return res.data;
}
