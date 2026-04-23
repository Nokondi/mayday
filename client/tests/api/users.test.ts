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
  createReport,
  getUser,
  getUserPosts,
  reportUser,
  updateProfile,
  uploadUserAvatar,
} from '../../src/api/users.js';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('users api', () => {
  describe('getUser', () => {
    it('GETs /users/:id and returns the response body', async () => {
      const response = { id: 'u1', name: 'A' };
      mockedApi.get.mockResolvedValueOnce({ data: response });

      const result = await getUser('u1');

      expect(mockedApi.get).toHaveBeenCalledWith('/users/u1');
      expect(result).toEqual(response);
    });
  });

  describe('updateProfile', () => {
    it('PUTs /users/:id with the provided data', async () => {
      const payload = { name: 'New name' } as never;
      mockedApi.put.mockResolvedValueOnce({ data: { id: 'u1', name: 'New name' } });

      const result = await updateProfile('u1', payload);

      expect(mockedApi.put).toHaveBeenCalledWith('/users/u1', payload);
      expect(result).toEqual({ id: 'u1', name: 'New name' });
    });
  });

  describe('uploadUserAvatar', () => {
    it('POSTs multipart FormData with the file under "avatar"', async () => {
      const file = new File(['img'], 'me.png', { type: 'image/png' });
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'u1' } });

      const result = await uploadUserAvatar('u1', file);

      expect(mockedApi.post).toHaveBeenCalledTimes(1);
      const [url, body, config] = mockedApi.post.mock.calls[0];
      expect(url).toBe('/users/u1/avatar');
      expect(body).toBeInstanceOf(FormData);
      expect((body as FormData).get('avatar')).toBe(file);
      expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
      expect(result).toEqual({ id: 'u1' });
    });
  });

  describe('getUserPosts', () => {
    it('GETs /users/:id/posts with the provided page', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });

      await getUserPosts('u1', 4);

      expect(mockedApi.get).toHaveBeenCalledWith('/users/u1/posts', {
        params: { page: 4 },
      });
    });

    it('defaults to page 1 when no page is provided', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });

      await getUserPosts('u1');

      expect(mockedApi.get).toHaveBeenCalledWith('/users/u1/posts', {
        params: { page: 1 },
      });
    });

    it('returns the response body', async () => {
      const response = { items: [{ id: 'p1' }], total: 1, page: 1, limit: 10 };
      mockedApi.get.mockResolvedValueOnce({ data: response });
      await expect(getUserPosts('u1')).resolves.toEqual(response);
    });
  });

  describe('createReport', () => {
    it('POSTs /reports with the provided payload', async () => {
      const payload = { reason: 'spam', details: 'nope', postId: 'p1' };
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'r1' } });

      const result = await createReport(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/reports', payload);
      expect(result).toEqual({ id: 'r1' });
    });

    it('allows reports with just a reason', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'r1' } });
      await createReport({ reason: 'spam' });
      expect(mockedApi.post).toHaveBeenCalledWith('/reports', { reason: 'spam' });
    });
  });

  describe('reportUser', () => {
    it('POSTs /reports/user with email + reason + optional details', async () => {
      const payload = { email: 'bad@example.com', reason: 'Harassment', details: 'context' };
      mockedApi.post.mockResolvedValueOnce({ data: { id: 'r1' } });

      const result = await reportUser(payload);

      expect(mockedApi.post).toHaveBeenCalledWith('/reports/user', payload);
      expect(result).toEqual({ id: 'r1' });
    });
  });
});
