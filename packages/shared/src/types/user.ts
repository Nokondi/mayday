export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  skills: string[];
  avatarUrl: string | null;
  role: Role;
  isBanned: boolean;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublicProfile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  skills: string[];
  avatarUrl: string | null;
  createdAt: string;
  fulfilledCount?: number;
}
