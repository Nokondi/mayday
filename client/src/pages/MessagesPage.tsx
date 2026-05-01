import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { getConversations, getConversationMessages, sendMessage } from '../api/messages.js';
import { useAuth } from '../context/AuthContext.js';
import { useWebSocket } from '../context/WebSocketContext.js';
import { ConversationList } from '../components/messages/ConversationList.js';
import { MessageThread } from '../components/messages/MessageThread.js';
import { MessageInput } from '../components/messages/MessageInput.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import type { WSMessage, Message } from '@mayday/shared';

export function MessagesPage() {
  const { user } = useAuth();
  const { addHandler, removeHandler } = useWebSocket();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
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

  const handleSend = async (content: string) => {
    if (!activeConversation) return;
    const msg = await sendMessage(activeConversation, content);
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
          <h2 className="font-semibold text-gray-900">Messages</h2>
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
              <MessageThread messages={messages || []} currentUserId={user!.id} />
            )}
            <MessageInput onSend={handleSend} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
