import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WSMessage } from '@mayday/shared';

vi.mock('../../../src/context/AuthContext.js', () => ({ useAuth: vi.fn() }));
vi.mock('../../../src/context/DeviceContext.js', () => ({ useDevice: vi.fn() }));
vi.mock('../../../src/context/WebSocketContext.js', () => ({ useWebSocket: vi.fn() }));
vi.mock('../../../src/crypto/rescue.js', () => ({
  rescueConversationKeysForDevice: vi.fn(),
  reconcileConversationKeys: vi.fn(),
}));

import { useAuth } from '../../../src/context/AuthContext.js';
import { useDevice } from '../../../src/context/DeviceContext.js';
import { useWebSocket } from '../../../src/context/WebSocketContext.js';
import {
  rescueConversationKeysForDevice,
  reconcileConversationKeys,
} from '../../../src/crypto/rescue.js';
import { RescueListener } from '../../../src/components/e2ee/RescueListener.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDevice = vi.mocked(useDevice);
const mockedUseWebSocket = vi.mocked(useWebSocket);
const mockedRescue = vi.mocked(rescueConversationKeysForDevice);
const mockedReconcile = vi.mocked(reconcileConversationKeys);

const USER_ID = '00000000-0000-4000-a000-000000000001';
const SERVER_ID = '00000000-0000-4000-a000-000000000010';
const NEW_DEVICE_ID = '00000000-0000-4000-a000-000000000011';

// Shape doesn't matter — the crypto module is mocked. It just needs to be a
// truthy object so the readiness guard passes.
const fakeDevice = {
  encryption: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) },
} as never;

let wsHandlers: Set<(m: WSMessage) => void>;

function setWebSocket(isConnected: boolean) {
  mockedUseWebSocket.mockReturnValue({
    isConnected,
    addHandler: (h: (m: WSMessage) => void) => { wsHandlers.add(h); },
    removeHandler: (h: (m: WSMessage) => void) => { wsHandlers.delete(h); },
  } as never);
}

function fireWS(msg: WSMessage) {
  for (const h of wsHandlers) h(msg);
}

beforeEach(() => {
  vi.clearAllMocks();
  wsHandlers = new Set();
  mockedUseAuth.mockReturnValue({ user: { id: USER_ID } } as never);
  mockedUseDevice.mockReturnValue({ device: fakeDevice, serverId: SERVER_ID } as never);
  setWebSocket(true);
});

describe('RescueListener', () => {
  it('runs the reconciliation sweep once connected', async () => {
    render(<RescueListener />);
    await waitFor(() => expect(mockedReconcile).toHaveBeenCalledTimes(1));
    expect(mockedReconcile).toHaveBeenCalledWith({
      ownDevice: fakeDevice,
      ownDeviceServerId: SERVER_ID,
    });
  });

  it('does not run the sweep while disconnected', async () => {
    setWebSocket(false);
    render(<RescueListener />);
    // Give effects a chance to run; the sweep must stay un-invoked.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockedReconcile).not.toHaveBeenCalled();
  });

  it('does nothing until the device identity is ready', async () => {
    mockedUseDevice.mockReturnValue({ device: null, serverId: null } as never);
    render(<RescueListener />);
    await new Promise((r) => setTimeout(r, 20));
    expect(mockedReconcile).not.toHaveBeenCalled();
    expect(mockedRescue).not.toHaveBeenCalled();
  });

  it('rescues a newly registered device on DEVICE_ADDED', async () => {
    render(<RescueListener />);
    await waitFor(() => expect(wsHandlers.size).toBeGreaterThan(0));

    const newDevice = {
      id: NEW_DEVICE_ID,
      userId: '00000000-0000-4000-a000-000000000002',
      signingPublicKey: 'AAAA',
      encryptionPublicKey: 'AAAA',
      encryptionKeySig: 'AAAA',
      createdAt: '2026-05-22T00:00:00Z',
    };
    fireWS({ type: 'DEVICE_ADDED', payload: { userId: newDevice.userId, device: newDevice } });

    await waitFor(() => expect(mockedRescue).toHaveBeenCalledTimes(1));
    expect(mockedRescue).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: USER_ID,
        ownDeviceServerId: SERVER_ID,
        newDevice,
      }),
    );
  });

  it('ignores WS events that are not DEVICE_ADDED', async () => {
    render(<RescueListener />);
    await waitFor(() => expect(wsHandlers.size).toBeGreaterThan(0));

    fireWS({
      type: 'KEY_WRAPS_UPDATED',
      payload: { conversationId: '00000000-0000-4000-a000-000000000030', deviceIds: [SERVER_ID] },
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(mockedRescue).not.toHaveBeenCalled();
  });
});
