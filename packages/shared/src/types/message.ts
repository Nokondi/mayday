import type { UserPublicProfile } from './user.js';
import type { PeerDevice } from './device.js';

export type MessageType = 'TEXT' | 'INVITE';

export type InviteMessageStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

// Structured payload carried by an INVITE message. The server populates this
// when an already-registered user is invited to an organization/community, or
// sent a friend request; the Messages UI renders it as an actionable card. Not
// secret — never encrypted.
export interface InviteMessageMetadata {
  inviteKind: 'ORGANIZATION' | 'COMMUNITY' | 'FRIEND';
  inviteId: string;
  // For ORGANIZATION/COMMUNITY: the org/community id and name. For FRIEND: the
  // requester's user id and name (so the card links to their profile).
  targetId: string;
  targetName: string;
  status: InviteMessageStatus;
}

// On-the-wire message. `content` is set for legacy (pre-E2EE) plaintext
// messages; encrypted messages leave it null and populate the envelope
// fields (ciphertext, nonce, senderDeviceId, keyEpoch, protocolVersion).
// All Bytes columns are base64-encoded on the wire. INVITE messages leave the
// content/envelope fields null and carry their detail in `metadata`.
export interface Message {
  id: string;
  type: MessageType;
  metadata: InviteMessageMetadata | null;
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
  | 'MESSAGE_UPDATED'
  | 'TYPING'
  | 'READ'
  | 'DEVICE_ADDED'
  | 'DEVICE_REVOKED'
  | 'KEY_WRAPS_UPDATED';

export interface WSNewMessage {
  type: 'NEW_MESSAGE';
  payload: Message;
}

// An existing message changed in place (not a new message). Currently emitted
// when an INVITE card's status flips on accept/decline/revoke. Clients replace
// the message by id rather than appending — re-using NEW_MESSAGE here would
// duplicate the message in the thread.
export interface WSMessageUpdated {
  type: 'MESSAGE_UPDATED';
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

// New wraps were uploaded for a conversation. Each recipient device gets
// this event so it knows to re-resolve its conversation key — covers the
// race where a fresh device's own-handoff wrap arrives moments after the
// device first asked for its wraps.
export interface WSKeyWrapsUpdated {
  type: 'KEY_WRAPS_UPDATED';
  payload: { conversationId: string; deviceIds: string[] };
}

export type WSMessage =
  | WSNewMessage
  | WSMessageUpdated
  | WSTyping
  | WSRead
  | WSDeviceAdded
  | WSDeviceRevoked
  | WSKeyWrapsUpdated;
