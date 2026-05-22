import type { ConversationKeyWrap, UploadKeyWrapsRequest } from '@mayday/shared';
import { api } from './client.js';

export async function uploadKeyWraps(
  conversationId: string,
  wraps: UploadKeyWrapsRequest['wraps'],
): Promise<void> {
  await api.post(`/messages/conversations/${conversationId}/key-wraps`, { wraps });
}

export async function getKeyWraps(conversationId: string): Promise<ConversationKeyWrap[]> {
  const res = await api.get<ConversationKeyWrap[]>(
    `/messages/conversations/${conversationId}/key-wraps`,
  );
  return res.data;
}
