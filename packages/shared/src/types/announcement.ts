import { z } from 'zod';

export const createAnnouncementSchema = z.object({
  message: z.string().min(1, 'Message is required').max(500),
});

export const updateAnnouncementSchema = z.object({
  message: z.string().min(1).max(500).optional(),
  active: z.boolean().optional(),
});

export type CreateAnnouncementRequest = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementRequest = z.infer<typeof updateAnnouncementSchema>;

export interface Announcement {
  id: string;
  message: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
