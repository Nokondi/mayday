import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import { verifyAccessToken } from '../utils/jwt.js';
import type { WSMessage } from '@mayday/shared';

const connections = new Map<string, Set<WebSocket>>();

// The JWT is passed via Sec-WebSocket-Protocol rather than the URL query
// string so it doesn't end up in access/proxy logs. The client offers two
// subprotocols: the sentinel (echoed back to complete the handshake) and
// the raw token. Keep this value in sync with client/src/context/WebSocketContext.tsx.
const AUTH_SUBPROTOCOL = 'mayday.auth.bearer';

function extractToken(req: IncomingMessage): string | null {
  const raw = req.headers['sec-websocket-protocol'];
  if (typeof raw !== 'string') return null;
  const protocols = raw.split(',').map((p) => p.trim());
  if (protocols[0] !== AUTH_SUBPROTOCOL) return null;
  return protocols[1] ?? null;
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    // Echo the sentinel back when offered so the browser completes the
    // handshake. Token validity is still checked in the 'connection' handler.
    handleProtocols: (protocols) =>
      protocols.has(AUTH_SUBPROTOCOL) ? AUTH_SUBPROTOCOL : false,
  });

  wss.on('connection', (ws, req) => {
    const token = extractToken(req);
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      ws.close(4001, 'Invalid token');
      return;
    }

    const userId = payload.id;

    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId)!.add(ws);

    ws.on('close', () => {
      const userConnections = connections.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          connections.delete(userId);
        }
      }
    });
  });
}

export function sendToUser(userId: string, message: WSMessage) {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const data = JSON.stringify(message);
  for (const ws of userConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}
