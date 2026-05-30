import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import { Lock } from "lucide-react";
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
      className="px-2 py-2"
      aria-label={intl.formatMessage({
        id: "messages.list.ariaLabel",
        defaultMessage: "Conversations",
      })}
    >
      {conversations.map((conv) => (
        <li key={conv.id} className="mb-2 last:mb-0">
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
            className={`group w-full text-left p-2 text-gray-900 transition-colors border border-mayday-300 rounded-r-2xl rounded-tl-2xl rounded-bl-xs ${
              activeId === conv.id
                ? "bg-white"
                : "hover:bg-mayday-700 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-medium`}>
                {conv.otherParticipant.name}
              </span>
              {conv.unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeId === conv.id
                      ? "bg-mayday-700 text-white"
                      : "bg-mayday-700 text-white group-hover:bg-white group-hover:text-mayday-700"
                  }`}
                >
                  {conv.unreadCount}
                </span>
              )}
            </div>
            {conv.lastMessage && (
              <p className={`text-sm truncate mt-1`}>
                {conv.lastMessage.content !== null ? (
                  conv.lastMessage.content
                ) : (
                  // For encrypted last messages the server can't supply a
                  // preview — show a generic placeholder rather than fetching
                  // and decrypting every conversation's last message just to
                  // render the sidebar.
                  <span className="inline-flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <FormattedMessage
                      id="messages.list.encryptedPreview"
                      defaultMessage="Encrypted message"
                    />
                  </span>
                )}
              </p>
            )}
            {conv.lastMessage && (
              <p className={`text-xs mt-1`}>
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
