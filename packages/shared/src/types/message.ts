import type { UserPublicProfile } from './user.js';
import type { PeerDevice } from './device.js';

// On-the-wire message. `content` is set for legacy (pre-E2EE) plaintext
// messages; encrypted messages leave it null and populate the envelope
// fields (ciphertext, nonce, senderDeviceId, keyEpoch, protocolVersion).
// All Bytes columns are base64-encoded on the wire.
export interface Message {
  id: string;
  content: string | null;
  ciphertext: string | null;
  nonce: string | null;
  senderDeviceId: string | null;
  keyEpoch: number | null;
  protocolVersion: number | null;
  senderId: string;
  receiverId: string;
  conversationId: string;
  readAt: string | null;
  createdAt: string;
}

// What a recipient device fetches to decrypt a conversation. Includes the
// caller's own device wraps (received from server filtered to their devices).
export interface ConversationKeyWrap {
  id: string;
  conversationId: string;
  deviceId: string;
  wrappedKey: string; // base64 of crypto_box_seal output
  keyEpoch: number;
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

export type WSMessageType =
  | 'NEW_MESSAGE'
  | 'TYPING'
  | 'READ'
  | 'DEVICE_ADDED'
  | 'DEVICE_REVOKED';

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

// A device was registered. Phase 1 emits this event but clients only log it;
// Phase 3 attaches handlers that wrap the conversation key for the new device
// (own-handoff) and that re-wrap from the peer side (peer-rescue).
export interface WSDeviceAdded {
  type: 'DEVICE_ADDED';
  payload: { userId: string; device: PeerDevice };
}

export interface WSDeviceRevoked {
  type: 'DEVICE_REVOKED';
  payload: { userId: string; deviceId: string };
}

export type WSMessage =
  | WSNewMessage
  | WSTyping
  | WSRead
  | WSDeviceAdded
  | WSDeviceRevoked;
