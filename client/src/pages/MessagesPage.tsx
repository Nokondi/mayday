import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  sendEncryptedMessage,
} from '../api/messages.js';
import { useAuth } from '../context/AuthContext.js';
import { useDevice } from '../context/DeviceContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { useServerConfig } from '../hooks/useServerConfig.js';
import { useConversationKey } from '../hooks/useConversationKey.js';
import { useDecryptedMessages } from '../hooks/useDecryptedMessages.js';
import { encryptToEnvelope } from '../crypto/envelope.js';
import { establishConversationKey } from '../crypto/establish.js';
import { ConversationList } from '../components/messages/ConversationList.js';
import { MessageThread } from '../components/messages/MessageThread.js';
import { MessageInput } from '../components/messages/MessageInput.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import type { WSMessage, Message } from '@mayday/shared';

export function MessagesPage() {
  const { user } = useAuth();
  const { device, serverId: deviceServerId } = useDevice();
  const { e2eeEnabled } = useServerConfig();
  const { addHandler, removeHandler } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialDraft = (location.state as { draft?: string } | null)?.draft ?? '';
  const [activeConversation, setActiveConversation] = useState(searchParams.get('conversation') || '');

  const { data: conversations, isLoading: convLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  });

  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ['messages', activeConversation],
    queryFn: () => getConversationMessages(activeConversation),
    enabled: !!activeConversation,
  });

  // Conversation key resolution. The hook fetches wraps from the server and
  // unwraps with the local device key. We also keep a session-local override
  // (`localCk`) for the freshly-established case: when we generate a CK to
  // send our first encrypted message, the hook hasn't been told about it yet,
  // so we hold it in component state until the next mount of the page.
  const resolvedCk = useConversationKey(activeConversation || null);
  const [localCk, setLocalCk] = useState<Uint8Array | null>(null);
  // Reset the session-local CK whenever we change conversations, so we never
  // accidentally apply a CK from one conversation to another.
  useEffect(() => { setLocalCk(null); }, [activeConversation]);
  const conversationKey = localCk ?? resolvedCk;

  const decryptedMessages = useDecryptedMessages(messages, conversationKey);

  const peerUserId = useMemo(() => {
    return conversations?.find((c) => c.id === activeConversation)?.otherParticipant.id ?? null;
  }, [conversations, activeConversation]);

  const handleNewMessage = useCallback((wsMsg: WSMessage) => {
    if (wsMsg.type === 'NEW_MESSAGE') {
      const msg = wsMsg.payload as Message;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (msg.conversationId === activeConversation) {
        queryClient.setQueryData<Message[]>(['messages', activeConversation], (old) =>
          old ? [...old, msg] : [msg]
        );
      }
    }
  }, [activeConversation, queryClient]);

  useEffect(() => {
    addHandler(handleNewMessage);
    return () => removeHandler(handleNewMessage);
  }, [handleNewMessage, addHandler, removeHandler]);

  // Sending decides between plaintext and encrypted at call time. Order of
  // checks reflects the rollout policy:
  //  1) E2EE off (or device not ready)             → plaintext (legacy path)
  //  2) E2EE on, CK already available              → encrypt with that CK
  //  3) E2EE on, no CK yet — try to establish one  → encrypt if peer has a device
  //  4) E2EE on, peer has no device                → plaintext (graceful fallback)
  const handleSend = async (content: string) => {
    if (!activeConversation) return;
    let msg: Message;

    if (!e2eeEnabled || !device || !deviceServerId) {
      msg = await sendMessage(activeConversation, content);
    } else if (conversationKey) {
      const envelope = await encryptToEnvelope(content, conversationKey, deviceServerId, 1);
      msg = await sendEncryptedMessage(activeConversation, envelope);
    } else if (peerUserId) {
      const fresh = await establishConversationKey(activeConversation, peerUserId, deviceServerId);
      if (fresh) {
        setLocalCk(fresh);
        const envelope = await encryptToEnvelope(content, fresh, deviceServerId, 1);
        msg = await sendEncryptedMessage(activeConversation, envelope);
      } else {
        msg = await sendMessage(activeConversation, content);
      }
    } else {
      msg = await sendMessage(activeConversation, content);
    }

    queryClient.setQueryData<Message[]>(['messages', activeConversation], (old) =>
      old ? [...old, msg] : [msg]
    );
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  if (convLoading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex">
      {/* Conversation list */}
      <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            <FormattedMessage
              id="messages.page.title"
              defaultMessage="Messages"
            />
          </h2>
        </div>
        <ConversationList
          conversations={conversations || []}
          activeId={activeConversation}
          onSelect={setActiveConversation}
        />
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col bg-white">
        {activeConversation ? (
          <>
            {msgLoading ? (
              <LoadingSpinner className="flex-1" />
            ) : (
              <MessageThread messages={decryptedMessages} currentUserId={user!.id} />
            )}
            <MessageInput onSend={handleSend} initialContent={initialDraft} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" />
              <p>
                <FormattedMessage
                  id="messages.page.emptyState"
                  defaultMessage="Select a conversation to start messaging"
                />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
