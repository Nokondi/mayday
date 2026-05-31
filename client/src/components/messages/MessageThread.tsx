import { Fragment, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { FormattedMessage, useIntl } from "react-intl";
import { Unlock } from "lucide-react";
import type { InviteMessageMetadata } from "@mayday/shared";
import type { RenderableMessage } from "../../crypto/render.js";
import { InviteMessageCard } from "./InviteMessageCard.js";

interface MessageThreadProps {
  messages: RenderableMessage[];
  currentUserId: string;
  // Invite-card actions. Optional: a thread with no invite messages never
  // invokes them.
  onAcceptInvite?: (metadata: InviteMessageMetadata) => void;
  onDeclineInvite?: (metadata: InviteMessageMetadata) => void;
  // inviteId currently being accepted/declined, to disable its buttons.
  actingInviteId?: string | null;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g;

function renderWithLinks(content: string, isMine: boolean) {
  const parts: Array<string | { url: string }> = [];
  let lastIndex = 0;
  for (const match of content.matchAll(URL_PATTERN)) {
    if (match.index! > lastIndex)
      parts.push(content.slice(lastIndex, match.index));
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

export function MessageThread({
  messages,
  currentUserId,
  onAcceptInvite,
  onDeclineInvite,
  actingInviteId,
}: MessageThreadProps) {
  const intl = useIntl();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the container directly instead of using scrollIntoView on a marker
  // element. scrollIntoView scrolls every ancestor scroll container — including
  // the window — to bring the target into view, which would scroll the page
  // body down and push the mobile drawer header behind the sticky global header.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      role="log"
      className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
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

        // Server-authored invitation: render an actionable card instead of a
        // text bubble. Only the invitee (receiver) sees Accept/Decline.
        if (msg.type === "INVITE" && msg.metadata) {
          const metadata = msg.metadata;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <InviteMessageCard
                metadata={metadata}
                isRecipient={msg.receiverId === currentUserId}
                onAccept={() => onAcceptInvite?.(metadata)}
                onDecline={() => onDeclineInvite?.(metadata)}
                isActing={actingInviteId === metadata.inviteId}
              />
            </div>
          );
        }

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
                  ? "bg-mayday-700 text-white rounded-br-sm"
                  : "bg-white text-gray-900 rounded-bl-sm border-mayday-300 border"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {renderWithLinks(msg.content, isMine)}
              </p>
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
                      defaultMessage:
                        "Sent before end-to-end encryption was enabled",
                    })}
                    className="inline-flex items-center gap-0.5"
                  >
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- decorative separator glyph; badge is labelled via aria-label and the sr-only text below */}
                    <span aria-hidden="true">·</span>
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
    </div>
  );
}
