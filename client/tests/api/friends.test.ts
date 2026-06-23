import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../src/api/client.js';
import {
  sendFriendRequest,
  getMyFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getUserFriends,
} from '../../src/api/friends.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('friends api', () => {
  it('sendFriendRequest POSTs /friends/requests with the userId', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { status: 'PENDING' } });
    const result = await sendFriendRequest('u2');
    expect(mockedApi.post).toHaveBeenCalledWith('/friends/requests', { userId: 'u2' });
    expect(result).toEqual({ status: 'PENDING' });
  });

  it('getMyFriendRequests GETs /friends/me/requests', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'r1' }] });
    const result = await getMyFriendRequests();
    expect(mockedApi.get).toHaveBeenCalledWith('/friends/me/requests');
    expect(result).toEqual([{ id: 'r1' }]);
  });

  it('acceptFriendRequest POSTs the accept endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await acceptFriendRequest('r1');
    expect(mockedApi.post).toHaveBeenCalledWith('/friends/me/requests/r1/accept');
  });

  it('declineFriendRequest POSTs the decline endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });
    await declineFriendRequest('r1');
    expect(mockedApi.post).toHaveBeenCalledWith('/friends/me/requests/r1/decline');
  });

  it('cancelFriendRequest DELETEs /friends/requests/:id', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: {} });
    await cancelFriendRequest('r1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/friends/requests/r1');
  });

  it('removeFriend DELETEs /friends/:userId', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: {} });
    await removeFriend('u2');
    expect(mockedApi.delete).toHaveBeenCalledWith('/friends/u2');
  });

  it('getUserFriends GETs /users/:id/friends', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'u3' }] });
    const result = await getUserFriends('u2');
    expect(mockedApi.get).toHaveBeenCalledWith('/users/u2/friends');
    expect(result).toEqual([{ id: 'u3' }]);
  });
});
