import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useIntl } from "react-intl";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  initialContent?: string;
}

export function MessageInput({ onSend, disabled, initialContent = "" }: MessageInputProps) {
  const intl = useIntl();
  const [content, setContent] = useState(initialContent);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      await onSend(content.trim());
      setContent("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-mayday-200 p-4 flex gap-2"
    >
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={intl.formatMessage({
          id: "messages.input.placeholder",
          defaultMessage: "Type a message...",
        })}
        aria-label={intl.formatMessage({
          id: "messages.input.ariaLabel",
          defaultMessage: "Type a message",
        })}
        disabled={disabled}
        className="flex-1 border border-mayday-300 rounded-full px-4 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={!content.trim() || sending || disabled}
        aria-label={intl.formatMessage({
          id: "messages.input.sendButtonAriaLabel",
          defaultMessage: "Send message",
        })}
        className="bg-mayday-700 text-white p-2 rounded-full hover:bg-mayday-800 disabled:opacity-50"
      >
        <Send className="w-5 h-5" aria-hidden="true" />
      </button>
    </form>
  );
}
