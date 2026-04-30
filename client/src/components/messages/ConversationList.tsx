import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@mayday/shared';

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, activeId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No conversations yet. Contact someone from a post to start chatting.
      </div>
    );
  }

  return (
    <ul aria-label="Conversations" className="divide-y divide-gray-200">
      {conversations.map((conv) => (
        <li key={conv.id}>
        <button
          onClick={() => onSelect(conv.id)}
          aria-label={`Conversation with ${conv.otherParticipant.name}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread` : ''}`}
          aria-current={activeId === conv.id || undefined}
          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
            activeId === conv.id ? 'bg-mayday-50' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{conv.otherParticipant.name}</span>
            {conv.unreadCount > 0 && (
              <span aria-hidden="true" className="bg-mayday-500 text-white text-xs px-2 py-0.5 rounded-full">
                {conv.unreadCount}
              </span>
            )}
          </div>
          {conv.lastMessage && (
            <p className="text-sm text-gray-500 truncate mt-1">
              {conv.lastMessage.content}
            </p>
          )}
          {conv.lastMessage && (
            <p className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
            </p>
          )}
        </button>
        </li>
      ))}
    </ul>
  );
}
