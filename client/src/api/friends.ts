import type { FriendRequest, UserPublicProfile } from '@mayday/shared';
import { api } from './client.js';

// Send a friend request to another user. The server may respond with status
// 'ACCEPTED' instead of 'PENDING' when the recipient already had a pending
// request to us (both sides tapped Add friend).
export async function sendFriendRequest(userId: string): Promise<{ status: string }> {
  const res = await api.post('/friends/requests', { userId });
  return res.data;
}

export async function getMyFriendRequests(): Promise<FriendRequest[]> {
  const res = await api.get('/friends/me/requests');
  return res.data;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await api.post(`/friends/me/requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await api.post(`/friends/me/requests/${requestId}/decline`);
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await api.delete(`/friends/requests/${requestId}`);
}

export async function removeFriend(userId: string): Promise<void> {
  await api.delete(`/friends/${userId}`);
}

export async function getUserFriends(userId: string): Promise<UserPublicProfile[]> {
  const res = await api.get(`/users/${userId}/friends`);
  return res.data;
}
