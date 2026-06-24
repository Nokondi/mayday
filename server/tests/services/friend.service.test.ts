import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    friendship: { findMany: vi.fn(), findUnique: vi.fn() },
    friendRequest: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../src/config/database.js';
import {
  orderedPair,
  getFriendIds,
  areFriends,
  getFriendStatus,
} from '../../src/services/friend.service.js';

const mockedFriendship = vi.mocked(prisma.friendship);
const mockedRequest = vi.mocked(prisma.friendRequest);

beforeEach(() => vi.clearAllMocks());

describe('orderedPair', () => {
  it('sorts the two ids regardless of argument order', () => {
    expect(orderedPair('b', 'a')).toEqual({ userAId: 'a', userBId: 'b' });
    expect(orderedPair('a', 'b')).toEqual({ userAId: 'a', userBId: 'b' });
  });
});

describe('getFriendIds', () => {
  it('returns the other side of each friendship, regardless of which column holds the user', async () => {
    mockedFriendship.findMany.mockResolvedValueOnce([
      { userAId: 'me', userBId: 'alice' },
      { userAId: 'bob', userBId: 'me' },
    ] as never);

    const ids = await getFriendIds('me');
    expect(ids).toEqual(['alice', 'bob']);
  });

  it('returns an empty list when the user has no friends', async () => {
    mockedFriendship.findMany.mockResolvedValueOnce([] as never);
    expect(await getFriendIds('me')).toEqual([]);
  });
});

describe('areFriends', () => {
  it('looks up the sorted pair and returns true when a row exists', async () => {
    mockedFriendship.findUnique.mockResolvedValueOnce({ id: 'f1' } as never);
    expect(await areFriends('b', 'a')).toBe(true);
    expect(mockedFriendship.findUnique).toHaveBeenCalledWith({
      where: { userAId_userBId: { userAId: 'a', userBId: 'b' } },
      select: { id: true },
    });
  });

  it('returns false when no friendship row exists', async () => {
    mockedFriendship.findUnique.mockResolvedValueOnce(null as never);
    expect(await areFriends('a', 'b')).toBe(false);
  });
});

describe('getFriendStatus', () => {
  it('is NONE for the viewer\'s own profile without any lookups', async () => {
    expect(await getFriendStatus('me', 'me')).toEqual({ status: 'NONE', requestId: null });
    expect(mockedFriendship.findUnique).not.toHaveBeenCalled();
  });

  it('is FRIENDS when a friendship exists', async () => {
    mockedFriendship.findUnique.mockResolvedValueOnce({ id: 'f1' } as never);
    expect(await getFriendStatus('me', 'them')).toEqual({ status: 'FRIENDS', requestId: null });
  });

  it('is REQUEST_RECEIVED when the other user has a pending incoming request', async () => {
    mockedFriendship.findUnique.mockResolvedValueOnce(null as never);
    // outgoing (me -> them): none; incoming (them -> me): pending.
    mockedRequest.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING' } as never);

    expect(await getFriendStatus('me', 'them')).toEqual({
      status: 'REQUEST_RECEIVED',
      requestId: 'r1',
    });
  });

  it('is REQUEST_SENT when the viewer has a pending outgoing request', async () => {
    mockedFriendship.findUnique.mockResolvedValueOnce(null as never);
    mockedRequest.findUnique
      .mockResolvedValueOnce({ id: 'r2', status: 'PENDING' } as never)
      .mockResolvedValueOnce(null as never);

    expect(await getFriendStatus('me', 'them')).toEqual({
      status: 'REQUEST_SENT',
      requestId: 'r2',
    });
  });
});
