import { api } from './client.js';
import type { Device, PeerDevice, RegisterDeviceRequest } from '@mayday/shared';

export async function registerDevice(body: RegisterDeviceRequest): Promise<Device> {
  const res = await api.post<Device>('/devices', body);
  return res.data;
}

export async function getMyDevices(): Promise<Device[]> {
  const res = await api.get<Device[]>('/devices/me');
  return res.data;
}

export async function getUserDevices(userId: string): Promise<PeerDevice[]> {
  const res = await api.get<PeerDevice[]>(`/devices/users/${userId}`);
  return res.data;
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await api.delete(`/devices/${deviceId}`);
}
