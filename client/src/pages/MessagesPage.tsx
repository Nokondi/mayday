import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Lock, ChevronLeft } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  sendEncryptedMessage,
} from "../api/messages.js";
import { useAuth } from "../context/AuthContext.js";
import { useDevice } from "../context/DeviceContext.js";
import { useWebSocket } from "../context/WebSocketContext.js";
import { useServerConfig } from "../hooks/useServerConfig.js";
import { useConversationKey } from "../hooks/useConversationKey.js";
import { useDecryptedMessages } from "../hooks/useDecryptedMessages.js";
import { encryptToEnvelope } from "../crypto/envelope.js";
import { establishConversationKey } from "../crypto/establish.js";
import { ConversationList } from "../components/messages/ConversationList.js";
import { MessageThread } from "../components/messages/MessageThread.js";
import { MessageInput } from "../components/messages/MessageInput.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import type { WSMessage, Message } from "@mayday/shared";

export function MessagesPage() {
  const { user } = useAuth();
  const { device, serverId: deviceServerId } = useDevice();
  const { e2eeEnabled } = useServerConfig();
  const { addHandler, removeHandler } = useWebSocket();
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialDraft =
    (location.state as { draft?: string } | null)?.draft ?? "";
  const [activeConversation, setActiveConversation] = useState(
    searchParams.get("conversation") || "",
  );
  // Callback ref: stored in state so the measurement effect below re-runs
  // when the element actually mounts. We can't use a plain useRef here
  // because the early-return spinner branch means the ref'd <div> doesn't
  // exist on the first render, and useLayoutEffect deps don't see useRef
  // mutations.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const { data: conversations, isLoading: convLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });

  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ["messages", activeConversation],
    queryFn: () => getConversationMessages(activeConversation),
    enabled: !!activeConversation,
  });

  // Conversation key resolution. The hook fetches wraps and unwraps with the
  // local device key, picking the highest-epoch wrap. We also keep a session-
  // local fallback (`localCk`) for the freshly-established case: when we
  // generate a CK to send our first encrypted message, the hook hasn't been
  // told about it yet, so we hold it in component state until the next mount.
  //
  // Priority order matters: the *hook* value takes precedence over local.
  // Post-rotation (Phase 5), the hook resolves to the new-epoch CK while
  // `localCk` may still hold the old one — using the hook's value ensures
  // the next send encrypts under the rotated CK so the revoked device can't
  // decrypt it even with its still-cached old CK.
  const resolved = useConversationKey(activeConversation || null);
  const [localCk, setLocalCk] = useState<{
    ck: Uint8Array;
    keyEpoch: number;
  } | null>(null);
  useEffect(() => {
    setLocalCk(null);
  }, [activeConversation]);
  const conversationKey = resolved ?? localCk;

  const decryptedMessages = useDecryptedMessages(
    messages,
    conversationKey?.ck ?? null,
  );

  const activeConv = useMemo(() => {
    return conversations?.find((c) => c.id === activeConversation) ?? null;
  }, [conversations, activeConversation]);
  const peerUserId = activeConv?.otherParticipant.id ?? null;
  const peerName = activeConv?.otherParticipant.name ?? "";

  // Render the "waiting for sync" banner when this device has no CK yet but
  // the conversation contains encrypted messages. This happens on a freshly
  // enrolled device before own-handoff (from a sister device) or peer-rescue
  // (from the peer's device) lands.
  const hasEncryptedMessages = useMemo(
    () => !!messages?.some((m) => m.ciphertext !== null),
    [messages],
  );
  const showWaitingBanner =
    e2eeEnabled && !conversationKey && hasEncryptedMessages;

  const handleNewMessage = useCallback(
    (wsMsg: WSMessage) => {
      if (wsMsg.type === "NEW_MESSAGE") {
        const msg = wsMsg.payload as Message;
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        if (msg.conversationId === activeConversation) {
          queryClient.setQueryData<Message[]>(
            ["messages", activeConversation],
            (old) => (old ? [...old, msg] : [msg]),
          );
        }
      }
    },
    [activeConversation, queryClient],
  );

  useEffect(() => {
    addHandler(handleNewMessage);
    return () => removeHandler(handleNewMessage);
  }, [handleNewMessage, addHandler, removeHandler]);

  // Lock body scroll and scroll-to-top while this page is mounted. This is
  // a separate effect from the height measurement below because the
  // measurement depends on the container being in the DOM — which it isn't
  // during the `convLoading` spinner branch — and we still want the body
  // locked even while loading. Without this split, a slow conversations
  // fetch would leave the body scrollable until the first render that
  // includes the ref'd container.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Size the container to fill exactly the area below the global chrome
  // (announcement banner + sticky header). We measure the container's
  // distance from the viewport top rather than using a fixed `calc()`
  // because the announcement banner is conditional, its rendered height
  // isn't known until it mounts, and it can be dismissed at runtime. The
  // ResizeObserver on <body> catches the layout shift whenever the banner
  // mounts, unmounts, or changes size; the window resize listener handles
  // viewport / breakpoint changes (the wave-divider height in the header
  // grows at `sm:`).
  //
  // The effect depends on `containerEl` (a setState-as-ref) rather than a
  // plain useRef so it re-runs once `convLoading` flips false and the
  // ref'd <div> finally mounts.
  useLayoutEffect(() => {
    const el = containerEl;
    if (!el) return;
    const update = () => {
      el.style.height = `calc(100dvh - ${el.getBoundingClientRect().top}px)`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      el.style.height = "";
    };
  }, [containerEl]);

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
      const envelope = await encryptToEnvelope(
        content,
        conversationKey.ck,
        deviceServerId,
        conversationKey.keyEpoch,
      );
      msg = await sendEncryptedMessage(activeConversation, envelope);
    } else if (peerUserId) {
      const fresh = await establishConversationKey(
        activeConversation,
        peerUserId,
        deviceServerId,
      );
      if (fresh) {
        // Establish creates the very first epoch — epoch 1.
        setLocalCk({ ck: fresh, keyEpoch: 1 });
        const envelope = await encryptToEnvelope(
          content,
          fresh,
          deviceServerId,
          1,
        );
        msg = await sendEncryptedMessage(activeConversation, envelope);
      } else {
        msg = await sendMessage(activeConversation, content);
      }
    } else {
      msg = await sendMessage(activeConversation, content);
    }

    queryClient.setQueryData<Message[]>(
      ["messages", activeConversation],
      (old) => (old ? [...old, msg] : [msg]),
    );
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  if (convLoading) return <LoadingSpinner className="py-20" />;

  return (
    <div
      ref={setContainerEl}
      className="max-w-6xl mx-auto flex relative overflow-hidden"
    >
      {/* Conversation list — full width on mobile, fixed sidebar on md+ */}
      <div className="w-full md:w-80 overflow-y-auto flex-shrink-0">
        <div className="p-4">
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

      {/*
        Message thread.
        - On mobile, this is an absolutely-positioned drawer that sits off-screen
          to the right by default and slides in when activeConversation is set.
        - On md+ it becomes a normal flex child sharing the row with the list.
        The translate classes are gated by md: so desktop is always at rest.
      */}
      <div
        className={`absolute inset-0 bg-mayday-50 md:relative md:flex-1 flex flex-col z-10 transform transition-transform duration-300 ease-in-out md:transform-none ${
          activeConversation
            ? "translate-x-0"
            : "translate-x-full md:translate-x-0"
        }`}
      >
        {activeConversation && (
          <div className="md:hidden sticky top-0 z-20 flex items-center gap-2 p-2 border-b border-mayday-200 bg-mayday-50">
            <button
              type="button"
              onClick={() => setActiveConversation("")}
              aria-label={intl.formatMessage({
                id: "messages.page.backToConversations",
                defaultMessage: "Back to conversations",
              })}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft
                className="w-5 h-5 text-gray-700"
                aria-hidden="true"
              />
            </button>
            {peerName && (
              <span className="font-medium text-gray-900 truncate">
                {peerName}
              </span>
            )}
          </div>
        )}
        {activeConversation ? (
          <>
            {showWaitingBanner && (
              <div
                role="status"
                className="bg-mayday-50 border-b border-mayday-200 text-mayday-800 text-sm px-4 py-2 flex items-center gap-2"
              >
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  <FormattedMessage
                    id="messages.page.waitingForSync"
                    defaultMessage="Older messages will appear once another of your devices or {peer} comes online to share the key."
                    values={{ peer: peerName }}
                  />
                </span>
              </div>
            )}
            {msgLoading ? (
              <LoadingSpinner className="flex-1" />
            ) : (
              <MessageThread
                messages={decryptedMessages}
                currentUserId={user!.id}
              />
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
