import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/client.js', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from '../../src/api/client.js';
import { searchUsers, setUserBanned } from '../../src/api/adminUsers.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe('searchUsers', () => {
  it('GETs /admin/users with no params when none provided', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    await searchUsers();
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/users', { params: {} });
  });

  it('forwards q, role, page, limit when set', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    await searchUsers({ q: 'alice', role: 'ADMIN', page: 2, limit: 10 });
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/users', {
      params: { q: 'alice', role: 'ADMIN', page: 2, limit: 10 },
    });
  });

  it('stringifies the banned boolean (true and false are both meaningful)', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    await searchUsers({ banned: false });
    expect(mockedApi.get).toHaveBeenCalledWith('/admin/users', { params: { banned: 'false' } });

    mockedApi.get.mockResolvedValueOnce({ data: { data: [], total: 0 } });
    await searchUsers({ banned: true });
    expect(mockedApi.get).toHaveBeenLastCalledWith('/admin/users', { params: { banned: 'true' } });
  });

  it('returns the response body', async () => {
    const body = { data: [{ id: 'u1' }], total: 1, page: 1, limit: 20, totalPages: 1 };
    mockedApi.get.mockResolvedValueOnce({ data: body });
    await expect(searchUsers()).resolves.toEqual(body);
  });
});

describe('setUserBanned', () => {
  it('PUTs /admin/users/:id/ban with the banned flag', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: {} });
    await setUserBanned('u1', true);
    expect(mockedApi.put).toHaveBeenCalledWith('/admin/users/u1/ban', { banned: true });
  });
});
