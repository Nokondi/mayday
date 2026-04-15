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
  acceptCommunityInvite,
  approveJoinRequest,
  createCommunity,
  declineCommunityInvite,
  deleteCommunity,
  getCommunity,
  getCommunityInvites,
  getCommunityJoinRequests,
  getCommunityMembers,
  getMyCommunityInvites,
  inviteToCommunity,
  listCommunities,
  listMyCommunities,
  rejectJoinRequest,
  removeCommunityMember,
  requestToJoinCommunity,
  revokeCommunityInvite,
  updateCommunity,
  updateCommunityMemberRole,
  uploadCommunityAvatar,
  withdrawJoinRequest,
} from '../../src/api/communities.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('communities api — listing & detail', () => {
  it('listCommunities GETs /communities forwarding params', async () => {
    const response = { items: [], total: 0, page: 1, limit: 10 };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    const params = { q: 'food', page: 2, limit: 20 };
    const result = await listCommunities(params);

    expect(mockedApi.get).toHaveBeenCalledWith('/communities', { params });
    expect(result).toEqual(response);
  });

  it('listCommunities works with no params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });
    await listCommunities();
    expect(mockedApi.get).toHaveBeenCalledWith('/communities', { params: undefined });
  });

  it('listMyCommunities GETs /communities/mine', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'c1' }] });
    const result = await listMyCommunities();
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/mine');
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('getCommunity GETs /communities/:id', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'c1' } });
    const result = await getCommunity('c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/c1');
    expect(result).toEqual({ id: 'c1' });
  });
});

describe('communities api — create / update / delete', () => {
  it('createCommunity POSTs /communities with the payload', async () => {
    const payload = { name: 'Helpers', description: 'x' } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });

    const result = await createCommunity(payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/communities', payload);
    expect(result).toEqual({ id: 'c1' });
  });

  it('updateCommunity PATCHes /communities/:id with the payload', async () => {
    const payload = { name: 'New Name' } as never;
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 'c1', name: 'New Name' } });

    const result = await updateCommunity('c1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/communities/c1', payload);
    expect(result).toEqual({ id: 'c1', name: 'New Name' });
  });

  it('uploadCommunityAvatar POSTs multipart FormData with the file under "avatar"', async () => {
    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'c1' } });

    const result = await uploadCommunityAvatar('c1', file);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/communities/c1/avatar');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('avatar')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(result).toEqual({ id: 'c1' });
  });

  it('deleteCommunity DELETEs /communities/:id', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await deleteCommunity('c1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/communities/c1');
  });
});

describe('communities api — members', () => {
  it('getCommunityMembers GETs /communities/:id/members', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ userId: 'u1' }] });
    const result = await getCommunityMembers('c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/c1/members');
    expect(result).toEqual([{ userId: 'u1' }]);
  });

  it('updateCommunityMemberRole PATCHes /communities/:id/members/:userId', async () => {
    const payload = { role: 'admin' } as never;
    mockedApi.patch.mockResolvedValueOnce({ data: { userId: 'u1', role: 'admin' } });

    const result = await updateCommunityMemberRole('c1', 'u1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/communities/c1/members/u1', payload);
    expect(result).toEqual({ userId: 'u1', role: 'admin' });
  });

  it('removeCommunityMember DELETEs /communities/:id/members/:userId', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await removeCommunityMember('c1', 'u1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/communities/c1/members/u1');
  });
});

describe('communities api — invites', () => {
  it('getCommunityInvites GETs /communities/:id/invites', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getCommunityInvites('c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/c1/invites');
  });

  it('inviteToCommunity POSTs /communities/:id/invites with the payload', async () => {
    const payload = { email: 'x@y.com' } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'inv1' } });

    const result = await inviteToCommunity('c1', payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/communities/c1/invites', payload);
    expect(result).toEqual({ id: 'inv1' });
  });

  it('revokeCommunityInvite DELETEs the specific invite', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await revokeCommunityInvite('c1', 'inv1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/communities/c1/invites/inv1');
  });

  it('getMyCommunityInvites GETs /communities/me/invites', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getMyCommunityInvites();
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/me/invites');
  });

  it('acceptCommunityInvite POSTs the accept endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await acceptCommunityInvite('inv1');
    expect(mockedApi.post).toHaveBeenCalledWith('/communities/me/invites/inv1/accept');
  });

  it('declineCommunityInvite POSTs the decline endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await declineCommunityInvite('inv1');
    expect(mockedApi.post).toHaveBeenCalledWith('/communities/me/invites/inv1/decline');
  });
});

describe('communities api — join requests', () => {
  it('requestToJoinCommunity POSTs /communities/:id/join-requests with the payload when given', async () => {
    const payload = { message: 'please' } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'jr1' } });

    const result = await requestToJoinCommunity('c1', payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/communities/c1/join-requests', payload);
    expect(result).toEqual({ id: 'jr1' });
  });

  it('requestToJoinCommunity defaults to an empty object body when no payload is given', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'jr1' } });
    await requestToJoinCommunity('c1');
    expect(mockedApi.post).toHaveBeenCalledWith('/communities/c1/join-requests', {});
  });

  it('withdrawJoinRequest DELETEs /communities/:id/join-requests', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await withdrawJoinRequest('c1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/communities/c1/join-requests');
  });

  it('getCommunityJoinRequests GETs /communities/:id/join-requests', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getCommunityJoinRequests('c1');
    expect(mockedApi.get).toHaveBeenCalledWith('/communities/c1/join-requests');
  });

  it('approveJoinRequest POSTs the approve endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await approveJoinRequest('c1', 'jr1');
    expect(mockedApi.post).toHaveBeenCalledWith('/communities/c1/join-requests/jr1/approve');
  });

  it('rejectJoinRequest POSTs the reject endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await rejectJoinRequest('c1', 'jr1');
    expect(mockedApi.post).toHaveBeenCalledWith('/communities/c1/join-requests/jr1/reject');
  });
});
