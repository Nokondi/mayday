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
  acceptInvite,
  createOrganization,
  declineInvite,
  deleteOrganization,
  getMyInvites,
  getOrganization,
  getOrganizationInvites,
  getOrganizationMembers,
  inviteToOrganization,
  listMyOrganizations,
  listOrganizations,
  removeMember,
  revokeInvite,
  updateMemberRole,
  updateOrganization,
  uploadOrganizationAvatar,
} from '../../src/api/organizations.js';

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

describe('organizations api — listing & detail', () => {
  it('listOrganizations GETs /organizations forwarding params', async () => {
    const response = { items: [], total: 0, page: 1, limit: 10 };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    const params = { q: 'aid', page: 2, limit: 20 };
    const result = await listOrganizations(params);

    expect(mockedApi.get).toHaveBeenCalledWith('/organizations', { params });
    expect(result).toEqual(response);
  });

  it('listOrganizations works with no params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });
    await listOrganizations();
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations', { params: undefined });
  });

  it('listMyOrganizations GETs /organizations/mine', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'o1' }] });
    const result = await listMyOrganizations();
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations/mine');
    expect(result).toEqual([{ id: 'o1' }]);
  });

  it('getOrganization GETs /organizations/:id', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'o1' } });
    const result = await getOrganization('o1');
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations/o1');
    expect(result).toEqual({ id: 'o1' });
  });
});

describe('organizations api — create / update / delete', () => {
  it('createOrganization POSTs /organizations with the payload', async () => {
    const payload = { name: 'Red Cross' } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'o1' } });

    const result = await createOrganization(payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/organizations', payload);
    expect(result).toEqual({ id: 'o1' });
  });

  it('updateOrganization PATCHes /organizations/:id with the payload', async () => {
    const payload = { name: 'Updated' } as never;
    mockedApi.patch.mockResolvedValueOnce({ data: { id: 'o1', name: 'Updated' } });

    const result = await updateOrganization('o1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/organizations/o1', payload);
    expect(result).toEqual({ id: 'o1', name: 'Updated' });
  });

  it('uploadOrganizationAvatar POSTs multipart FormData with the file under "avatar"', async () => {
    const file = new File(['img'], 'logo.png', { type: 'image/png' });
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'o1' } });

    const result = await uploadOrganizationAvatar('o1', file);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/organizations/o1/avatar');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('avatar')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(result).toEqual({ id: 'o1' });
  });

  it('deleteOrganization DELETEs /organizations/:id', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await deleteOrganization('o1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/organizations/o1');
  });
});

describe('organizations api — members', () => {
  it('getOrganizationMembers GETs /organizations/:id/members', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ userId: 'u1' }] });
    const result = await getOrganizationMembers('o1');
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations/o1/members');
    expect(result).toEqual([{ userId: 'u1' }]);
  });

  it('updateMemberRole PATCHes /organizations/:id/members/:userId', async () => {
    const payload = { role: 'admin' } as never;
    mockedApi.patch.mockResolvedValueOnce({ data: { userId: 'u1', role: 'admin' } });

    const result = await updateMemberRole('o1', 'u1', payload);

    expect(mockedApi.patch).toHaveBeenCalledWith('/organizations/o1/members/u1', payload);
    expect(result).toEqual({ userId: 'u1', role: 'admin' });
  });

  it('removeMember DELETEs /organizations/:id/members/:userId', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await removeMember('o1', 'u1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/organizations/o1/members/u1');
  });
});

describe('organizations api — invites', () => {
  it('getOrganizationInvites GETs /organizations/:id/invites', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getOrganizationInvites('o1');
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations/o1/invites');
  });

  it('inviteToOrganization POSTs /organizations/:id/invites with the payload', async () => {
    const payload = { email: 'x@y.com' } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'inv1' } });

    const result = await inviteToOrganization('o1', payload);

    expect(mockedApi.post).toHaveBeenCalledWith('/organizations/o1/invites', payload);
    expect(result).toEqual({ id: 'inv1' });
  });

  it('revokeInvite DELETEs the specific invite', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await revokeInvite('o1', 'inv1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/organizations/o1/invites/inv1');
  });

  it('getMyInvites GETs /organizations/me/invites', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getMyInvites();
    expect(mockedApi.get).toHaveBeenCalledWith('/organizations/me/invites');
  });

  it('acceptInvite POSTs the accept endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await acceptInvite('inv1');
    expect(mockedApi.post).toHaveBeenCalledWith('/organizations/me/invites/inv1/accept');
  });

  it('declineInvite POSTs the decline endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: undefined });
    await declineInvite('inv1');
    expect(mockedApi.post).toHaveBeenCalledWith('/organizations/me/invites/inv1/decline');
  });
});
