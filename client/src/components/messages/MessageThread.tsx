import { Fragment, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import { Unlock } from "lucide-react";
import type { RenderableMessage } from "../../crypto/render.js";

interface MessageThreadProps {
  messages: RenderableMessage[];
  currentUserId: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g;

function renderWithLinks(content: string, isMine: boolean) {
  const parts: Array<string | { url: string }> = [];
  let lastIndex = 0;
  for (const match of content.matchAll(URL_PATTERN)) {
    if (match.index! > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push({ url: match[0] });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <a
        key={i}
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline ${isMine ? "text-white" : "text-mayday-700"}`}
      >
        {part.url}
      </a>
    ),
  );
}

export function MessageThread({ messages, currentUserId }: MessageThreadProps) {
  const intl = useIntl();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      role="log"
      className="flex-1 overflow-y-auto p-4 space-y-3"
      aria-live="polite"
      aria-label={intl.formatMessage({
        id: "messages.thread.ariaLabel",
        defaultMessage: "Message history",
      })}
    >
      {messages.map((msg) => {
        const isMine = msg.senderId === currentUserId;
        const sentAt = new Date(msg.createdAt);
        const relativeTime = formatDistanceToNow(sentAt, { addSuffix: true });
        const senderLabel = isMine
          ? intl.formatMessage({
              id: "messages.thread.senderYou",
              defaultMessage: "You",
            })
          : intl.formatMessage({
              id: "messages.thread.senderOther",
              defaultMessage: "Other participant",
            });
        return (
          <article
            key={msg.id}
            aria-label={intl.formatMessage(
              {
                id: "messages.thread.messageAriaLabel",
                defaultMessage: "{sender} said {content}, {time}",
              },
              { sender: senderLabel, content: msg.content, time: relativeTime },
            )}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                isMine
                  ? "bg-mayday-700 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{renderWithLinks(msg.content, isMine)}</p>
              <p
                className={`text-xs mt-1 flex items-center gap-1 ${isMine ? "text-mayday-200" : "text-gray-500"}`}
              >
                <time dateTime={sentAt.toISOString()}>{relativeTime}</time>
                {msg.encryptionStatus === "legacy" && (
                  // Pre-E2EE plaintext message. The badge signals that this
                  // particular message wasn't end-to-end encrypted, so a user
                  // verifying their conversation's confidentiality knows where
                  // the encrypted boundary starts.
                  <span
                    aria-label={intl.formatMessage({
                      id: "messages.thread.legacyBadge",
                      defaultMessage: "Not end-to-end encrypted",
                    })}
                    title={intl.formatMessage({
                      id: "messages.thread.legacyBadgeTitle",
                      defaultMessage: "Sent before end-to-end encryption was enabled",
                    })}
                    className="inline-flex items-center gap-0.5"
                  >
                    &middot;
                    <Unlock className="w-3 h-3" aria-hidden="true" />
                    <span className="sr-only">
                      <FormattedMessage
                        id="messages.thread.legacyBadge"
                        defaultMessage="Not end-to-end encrypted"
                      />
                    </span>
                  </span>
                )}
              </p>
            </div>
          </article>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
