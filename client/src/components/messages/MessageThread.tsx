import { useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@mayday/shared";

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
}

export function MessageThread({ messages, currentUserId }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      role="log"
      className="flex-1 overflow-y-auto p-4 space-y-3"
      aria-live="polite"
      aria-label="Message history"
    >
      {messages.map((msg) => {
        const isMine = msg.senderId === currentUserId;
        const sentAt = new Date(msg.createdAt);
        const relativeTime = formatDistanceToNow(sentAt, { addSuffix: true });
        const senderLabel = isMine ? "You" : "Other participant";
        return (
          <article
            key={msg.id}
            aria-label={`${senderLabel} said ${msg.content}, ${relativeTime}`}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                isMine
                  ? "bg-mayday-700 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p
                className={`text-xs mt-1 ${isMine ? "text-mayday-200" : "text-gray-500"}`}
              >
                <time dateTime={sentAt.toISOString()}>{relativeTime}</time>
              </p>
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
