import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { verifyAccessToken } from '../utils/jwt.js';
import type { WSMessage } from '@mayday/shared';

const connections = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

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
