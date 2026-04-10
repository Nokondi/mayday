import type { Conversation, Message, StartConversationRequest } from '@mayday/shared';
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

export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const res = await api.post(`/messages/conversations/${conversationId}/messages`, { content });
  return res.data;
}
