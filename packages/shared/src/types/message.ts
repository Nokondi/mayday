import type { UserPublicProfile } from './user.js';

export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  readAt: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantAId: string;
  participantBId: string;
  createdAt: string;
  updatedAt: string;
  otherParticipant: UserPublicProfile;
  lastMessage: Message | null;
  unreadCount: number;
}

export type WSMessageType = 'NEW_MESSAGE' | 'TYPING' | 'READ';

export interface WSNewMessage {
  type: 'NEW_MESSAGE';
  payload: Message;
}

export interface WSTyping {
  type: 'TYPING';
  payload: { conversationId: string; userId: string };
}

export interface WSRead {
  type: 'READ';
  payload: { conversationId: string; messageId: string };
}

export type WSMessage = WSNewMessage | WSTyping | WSRead;
