import { useEffect, useState } from 'react';
import type { Message } from '@mayday/shared';
import { renderMessages, type RenderableMessage } from '../crypto/render.js';

// Pure derivation of decrypted messages from the raw wire list + conversation
// key. We use useEffect rather than useMemo because decryption is async (the
// libsodium WASM module loads lazily). Re-runs whenever raw or ck changes.
export function useDecryptedMessages(
  raw: Message[] | undefined,
  conversationKey: Uint8Array | null,
): RenderableMessage[] {
  const [out, setOut] = useState<RenderableMessage[]>([]);

  useEffect(() => {
    if (!raw) { setOut([]); return; }
    let cancelled = false;
    (async () => {
      const result = await renderMessages(raw, conversationKey);
      if (!cancelled) setOut(result);
    })();
    return () => { cancelled = true; };
  }, [raw, conversationKey]);

  return out;
}
