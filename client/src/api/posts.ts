import type { CreatePostRequest, UpdatePostRequest, FulfillPostRequest, PostQueryParams, PaginatedResponse, PostWithAuthor } from '@mayday/shared';
import { api } from './client.js';

export async function getPosts(params?: PostQueryParams): Promise<PaginatedResponse<PostWithAuthor>> {
  const res = await api.get('/posts', { params });
  return res.data;
}

export async function getPost(id: string): Promise<PostWithAuthor> {
  const res = await api.get(`/posts/${id}`);
  return res.data;
}

export async function getPostMatches(id: string): Promise<PostWithAuthor[]> {
  const res = await api.get(`/posts/${id}/matches`);
  return res.data;
}

export async function createPost(data: CreatePostRequest, images?: File[]): Promise<PostWithAuthor> {
  const formData = new FormData();

  // Append all post fields
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  // Append image files
  if (images) {
    for (const file of images) {
      formData.append('images', file);
    }
  }

  const res = await api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updatePost(id: string, data: UpdatePostRequest): Promise<PostWithAuthor> {
  const res = await api.put(`/posts/${id}`, data);
  return res.data;
}

export async function deletePost(id: string): Promise<void> {
  await api.delete(`/posts/${id}`);
}

export async function searchPosts(params: { q: string; type?: string; category?: string; page?: number; limit?: number }): Promise<PaginatedResponse<PostWithAuthor>> {
  const res = await api.get('/search', { params });
  return res.data;
}

export async function fulfillPost(id: string, data: FulfillPostRequest): Promise<PostWithAuthor> {
  const res = await api.post(`/posts/${id}/fulfill`, data);
  return res.data;
}

export async function reopenPost(id: string): Promise<PostWithAuthor> {
  const res = await api.post(`/posts/${id}/reopen`);
  return res.data;
}

export async function searchFulfillers(q: string): Promise<{
  users: Array<{ id: string; name: string; avatarUrl: string | null }>;
  organizations: Array<{ id: string; name: string; avatarUrl: string | null }>;
}> {
  const res = await api.get('/posts/fulfiller-search', { params: { q } });
  return res.data;
}
