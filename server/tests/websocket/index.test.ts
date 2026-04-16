import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sendToUser, setupWebSocket } from '../../src/websocket/index.js';
import { signAccessToken } from '../../src/utils/jwt.js';

/**
 * These tests spin up a real HTTP server bound to an ephemeral port, attach
 * the production WebSocket handler to it, and drive it with the real `ws`
 * client. That exercises both the connection lifecycle (token parsing, close
 * codes) and the sendToUser routing without any mocking.
 */

let httpServer: Server;
let port: number;

function waitFor<T>(
  predicate: () => T | undefined,
  timeoutMs = 2000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      const value = predicate();
      if (value !== undefined) return resolve(value);
      if (Date.now() > deadline) return reject(new Error('waitFor timeout'));
      setTimeout(check, 10);
    };
    check();
  });
}

function openWs(token: string | null): WebSocket {
  const suffix = token === null ? '' : `?token=${encodeURIComponent(token)}`;
  return new WebSocket(`ws://localhost:${port}/ws${suffix}`);
}

function closedCode(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.on('close', (code) => resolve(code));
  });
}

beforeEach(async () => {
  httpServer = createServer();
  setupWebSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('setupWebSocket — authentication', () => {
  it('closes the connection with code 4001 when no token is provided', async () => {
    const ws = openWs(null);
    const code = await closedCode(ws);
    expect(code).toBe(4001);
  });

  it('closes the connection with code 4001 when the token is invalid', async () => {
    const ws = openWs('definitely-not-a-jwt');
    const code = await closedCode(ws);
    expect(code).toBe(4001);
  });

  it('keeps the connection open when the token is valid', async () => {
    const token = signAccessToken({ id: 'u1', email: 'a@b.com', role: 'USER' });
    const ws = openWs(token);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('close', (code) => reject(new Error(`closed with ${code}`)));
    });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });
});

describe('sendToUser', () => {
  it('delivers a message to a connected user', async () => {
    const token = signAccessToken({ id: 'u42', email: 'a@b.com', role: 'USER' });
    const ws = openWs(token);
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    const received = new Promise<string>((resolve) => {
      ws.on('message', (data) => resolve(data.toString()));
    });

    // Give the server a tick to register the connection in the map.
    await new Promise((r) => setTimeout(r, 20));
    sendToUser('u42', {
      type: 'TYPING',
      payload: { conversationId: 'c1', userId: 'u2' },
    });

    const data = await received;
    expect(JSON.parse(data)).toEqual({
      type: 'TYPING',
      payload: { conversationId: 'c1', userId: 'u2' },
    });
    ws.close();
  });

  it('is a no-op when the user has no active connection', () => {
    // Should not throw even though "ghost-user" is not connected.
    expect(() =>
      sendToUser('ghost-user', {
        type: 'TYPING',
        payload: { conversationId: 'c1', userId: 'u2' },
      }),
    ).not.toThrow();
  });

  it('delivers to every active connection a single user has', async () => {
    const token = signAccessToken({ id: 'multi', email: 'a@b.com', role: 'USER' });
    const wsA = openWs(token);
    const wsB = openWs(token);
    await Promise.all([
      new Promise<void>((r) => wsA.on('open', () => r())),
      new Promise<void>((r) => wsB.on('open', () => r())),
    ]);
    await new Promise((r) => setTimeout(r, 20));

    const receivedA = new Promise<string>((r) => wsA.on('message', (d) => r(d.toString())));
    const receivedB = new Promise<string>((r) => wsB.on('message', (d) => r(d.toString())));

    sendToUser('multi', {
      type: 'TYPING',
      payload: { conversationId: 'c1', userId: 'x' },
    });

    const [a, b] = await Promise.all([receivedA, receivedB]);
    expect(JSON.parse(a)).toMatchObject({ type: 'TYPING' });
    expect(JSON.parse(b)).toMatchObject({ type: 'TYPING' });

    wsA.close();
    wsB.close();
  });

  it('stops delivering after the connection is closed', async () => {
    const token = signAccessToken({ id: 'u99', email: 'a@b.com', role: 'USER' });
    const ws = openWs(token);
    await new Promise<void>((r) => ws.on('open', () => r()));
    await new Promise((r) => setTimeout(r, 20));

    ws.close();
    // Wait for the server-side cleanup in the 'close' handler.
    await waitFor(() => (ws.readyState === WebSocket.CLOSED ? true : undefined));
    await new Promise((r) => setTimeout(r, 20));

    // Must not throw; no one is listening but that's fine.
    expect(() =>
      sendToUser('u99', {
        type: 'TYPING',
        payload: { conversationId: 'c1', userId: 'x' },
      }),
    ).not.toThrow();
  });
});
