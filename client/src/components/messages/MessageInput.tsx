import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      await onSend(content.trim());
      setContent('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:ring-2 focus:ring-mayday-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={!content.trim() || sending || disabled}
        className="bg-mayday-500 text-white p-2 rounded-full hover:bg-mayday-600 disabled:opacity-50"
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  );
}
