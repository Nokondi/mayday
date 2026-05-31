import type { Message, MessageType, InviteMessageMetadata } from '@mayday/shared';
import { decryptEnvelope } from './envelope.js';

// The UI never sees the raw wire shape. We transform each Message into a
// RenderableMessage that always has a content string (with a placeholder when
// decryption isn't possible) plus an explicit encryptionStatus so components
// can render the legacy-not-encrypted badge or a "couldn't decrypt" state.
export type EncryptionStatus = 'encrypted' | 'legacy' | 'failed' | 'pending';

export interface RenderableMessage {
  id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  createdAt: string;
  readAt: string | null;
  content: string;
  encryptionStatus: EncryptionStatus;
  type: MessageType;
  metadata: InviteMessageMetadata | null;
}

const FAILED_PLACEHOLDER = '\u{1F512} Could not decrypt this message';
const PENDING_PLACEHOLDER = '\u{1F512} Decrypting…';

function meta(msg: Message) {
  return {
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    conversationId: msg.conversationId,
    createdAt: msg.createdAt,
    readAt: msg.readAt,
    type: msg.type,
    metadata: msg.metadata,
  };
}

export async function toRenderable(
  msg: Message,
  conversationKey: Uint8Array | null,
): Promise<RenderableMessage> {
  // Server-authored invite card. Never encrypted — its detail lives in
  // `metadata`, which the thread renders instead of a text bubble. Content
  // stays empty so the bubble path is never taken for these.
  if (msg.type === 'INVITE') {
    return { ...meta(msg), content: '', encryptionStatus: 'legacy' };
  }
  // Legacy plaintext (pre-Phase-2 messages). Content is in the clear; the
  // UI shows a badge so the user knows this one wasn't encrypted.
  if (msg.content !== null) {
    return { ...meta(msg), content: msg.content, encryptionStatus: 'legacy' };
  }
  // Encrypted but we don't have the conversation key yet — decryption is
  // still resolving (or this device was never wrapped). Show pending and let
  // the next render re-attempt once the key arrives.
  if (!conversationKey) {
    return { ...meta(msg), content: PENDING_PLACEHOLDER, encryptionStatus: 'pending' };
  }
  const decrypted = await decryptEnvelope(msg, conversationKey);
  if (decrypted === null) {
    return { ...meta(msg), content: FAILED_PLACEHOLDER, encryptionStatus: 'failed' };
  }
  return { ...meta(msg), content: decrypted, encryptionStatus: 'encrypted' };
}

export async function renderMessages(
  messages: Message[],
  conversationKey: Uint8Array | null,
): Promise<RenderableMessage[]> {
  return Promise.all(messages.map((m) => toRenderable(m, conversationKey)));
}
