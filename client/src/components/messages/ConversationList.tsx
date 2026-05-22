import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import type { Conversation } from "@mayday/shared";

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps) {
  const intl = useIntl();

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <FormattedMessage
          id="messages.list.emptyState"
          defaultMessage="No conversations yet. Contact someone from a post to start chatting."
        />
      </div>
    );
  }

  return (
    <ul
      aria-label={intl.formatMessage({
        id: "messages.list.ariaLabel",
        defaultMessage: "Conversations",
      })}
      className="divide-y divide-gray-200"
    >
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            onClick={() => onSelect(conv.id)}
            aria-label={intl.formatMessage(
              {
                id: "messages.list.conversationAriaLabel",
                defaultMessage:
                  "Conversation with {name}{unread, plural, =0 {} other {, # unread}}",
              },
              { name: conv.otherParticipant.name, unread: conv.unreadCount },
            )}
            aria-current={activeId === conv.id || undefined}
            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
              activeId === conv.id ? "bg-mayday-50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {conv.otherParticipant.name}
              </span>
              {conv.unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="bg-mayday-700 text-white text-xs px-2 py-0.5 rounded-full"
                >
                  {conv.unreadCount}
                </span>
              )}
            </div>
            {conv.lastMessage && (
              <p className="text-sm text-gray-500 truncate mt-1">
                {conv.lastMessage.content !== null ? (
                  conv.lastMessage.content
                ) : (
                  // For encrypted last messages the server can't supply a
                  // preview — show a generic placeholder rather than fetching
                  // and decrypting every conversation's last message just to
                  // render the sidebar.
                  <FormattedMessage
                    id="messages.list.encryptedPreview"
                    defaultMessage="\u{1F512} Encrypted message"
                  />
                )}
              </p>
            )}
            {conv.lastMessage && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(conv.lastMessage.createdAt), {
                  addSuffix: true,
                })}
              </p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
