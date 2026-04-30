import type { Announcement, CreateAnnouncementRequest, UpdateAnnouncementRequest } from '@mayday/shared';
import { api } from './client.js';

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  const res = await api.get('/announcements/active');
  return res.data;
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const res = await api.get('/announcements');
  return res.data;
}

export async function createAnnouncement(data: CreateAnnouncementRequest): Promise<Announcement> {
  const res = await api.post('/announcements', data);
  return res.data;
}

export async function updateAnnouncement(id: string, data: UpdateAnnouncementRequest): Promise<Announcement> {
  const res = await api.put(`/announcements/${id}`, data);
  return res.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}
