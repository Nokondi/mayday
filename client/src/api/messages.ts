import type {
  Conversation,
  Message,
  StartConversationRequest,
  EncryptedEnvelope,
} from '@mayday/shared';
import { api } from './client.js';

export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get('/messages/conversations');
  return res.data;
}

export async function getConversationMessages(id: string, page = 1): Promise<Message[]> {
  const res = await api.get(`/messages/conversations/${id}`, { params: { page } });
  return res.data;
}

export async function startConversation(data: StartConversationRequest): Promise<Conversation> {
  const res = await api.post('/messages/conversations', data);
  return res.data;
}

// Send a plaintext message. Pre-Phase-2 callers continue to use this when
// E2EE isn't enabled, the peer has no enrolled device, or the conversation
// hasn't been encrypted yet.
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const res = await api.post(`/messages/conversations/${conversationId}/messages`, { content });
  return res.data;
}

// Send an already-encrypted envelope. Server treats both shapes the same —
// it just stores whichever fields arrive.
export async function sendEncryptedMessage(
  conversationId: string,
  envelope: EncryptedEnvelope,
): Promise<Message> {
  const res = await api.post(`/messages/conversations/${conversationId}/messages`, { envelope });
  return res.data;
}
