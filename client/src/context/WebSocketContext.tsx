import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext.js';
import { getAccessToken } from '../api/client.js';
import type { WSMessage } from '@mayday/shared';

type MessageHandler = (message: WSMessage) => void;

interface WebSocketContextType {
  isConnected: boolean;
  addHandler: (handler: MessageHandler) => void;
  removeHandler: (handler: MessageHandler) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || !user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // The JWT is sent as a WebSocket subprotocol rather than a URL query
    // string so it doesn't leak into proxy/access logs. Keep the sentinel
    // in sync with server/src/websocket/index.ts.
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws`,
      ['mayday.auth.bearer', token],
    );

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        for (const handler of handlersRef.current) {
          handler(message);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Reconnect with backoff
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, [user]);

  useEffect(() => {
    if (user) {
      connect();
    }
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, connect]);

  const addHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
  }, []);

  const removeHandler = useCallback((handler: MessageHandler) => {
    handlersRef.current.delete(handler);
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, addHandler, removeHandler }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
}
