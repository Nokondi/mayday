import type { RegisterRequest, LoginRequest, AuthResponse, ResendVerificationRequest } from '@mayday/shared';
import { api } from './client.js';

export interface RegisterResponse {
  message: string;
  user: { id: string; email: string; name: string };
}

export interface MessageResponse {
  message: string;
}

export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const res = await api.post('/auth/register', data);
  return res.data;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await api.post('/auth/login', data);
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data;
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  const res = await api.get('/auth/verify-email', { params: { token } });
  return res.data;
}

export async function resendVerification(data: ResendVerificationRequest): Promise<MessageResponse> {
  const res = await api.post('/auth/resend-verification', data);
  return res.data;
}
