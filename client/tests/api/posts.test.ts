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
  createPost,
  deletePost,
  getPost,
  getPostMatches,
  getPosts,
  searchPosts,
  updatePost,
} from '../../src/api/posts.js';

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

describe('posts api — reads', () => {
  it('getPosts GETs /posts forwarding params', async () => {
    const response = { items: [], total: 0, page: 1, limit: 10 };
    mockedApi.get.mockResolvedValueOnce({ data: response });

    const params = { page: 2, limit: 20 } as never;
    const result = await getPosts(params);

    expect(mockedApi.get).toHaveBeenCalledWith('/posts', { params });
    expect(result).toEqual(response);
  });

  it('getPosts works with no params', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });
    await getPosts();
    expect(mockedApi.get).toHaveBeenCalledWith('/posts', { params: undefined });
  });

  it('getPost GETs /posts/:id', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'p1' } });
    const result = await getPost('p1');
    expect(mockedApi.get).toHaveBeenCalledWith('/posts/p1');
    expect(result).toEqual({ id: 'p1' });
  });

  it('getPostMatches GETs /posts/:id/matches', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'p2' }] });
    const result = await getPostMatches('p1');
    expect(mockedApi.get).toHaveBeenCalledWith('/posts/p1/matches');
    expect(result).toEqual([{ id: 'p2' }]);
  });
});

describe('posts api — createPost', () => {
  it('POSTs /posts with FormData containing stringified fields and the multipart header', async () => {
    const payload = {
      title: 'Need food',
      category: 'Food',
      priority: 2,
      isUrgent: true,
    } as never;
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'p1' } });

    const result = await createPost(payload);

    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/posts');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('title')).toBe('Need food');
    expect(form.get('category')).toBe('Food');
    // Non-string fields are stringified
    expect(form.get('priority')).toBe('2');
    expect(form.get('isUrgent')).toBe('true');
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(result).toEqual({ id: 'p1' });
  });

  it('skips undefined and null fields when building FormData', async () => {
    const payload = {
      title: 'Need food',
      description: undefined,
      location: null,
    } as unknown as Parameters<typeof createPost>[0];
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'p1' } });

    await createPost(payload);

    const form = mockedApi.post.mock.calls[0][1] as FormData;
    expect(form.get('title')).toBe('Need food');
    expect(form.has('description')).toBe(false);
    expect(form.has('location')).toBe(false);
  });

  it('appends each image file under the "images" key', async () => {
    const payload = { title: 't' } as never;
    const img1 = new File(['a'], 'a.png', { type: 'image/png' });
    const img2 = new File(['b'], 'b.png', { type: 'image/png' });
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'p1' } });

    await createPost(payload, [img1, img2]);

    const form = mockedApi.post.mock.calls[0][1] as FormData;
    const images = form.getAll('images');
    expect(images).toHaveLength(2);
    expect(images[0]).toBe(img1);
    expect(images[1]).toBe(img2);
  });

  it('omits the images key when no images are supplied', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { id: 'p1' } });
    await createPost({ title: 't' } as never);
    const form = mockedApi.post.mock.calls[0][1] as FormData;
    expect(form.has('images')).toBe(false);
  });
});

describe('posts api — mutations', () => {
  it('updatePost PUTs /posts/:id with the payload', async () => {
    const payload = { title: 'New title' } as never;
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'p1', title: 'New title' } });

    const result = await updatePost('p1', payload);

    expect(mockedApi.put).toHaveBeenCalledWith('/posts/p1', payload);
    expect(result).toEqual({ id: 'p1', title: 'New title' });
  });

  it('deletePost DELETEs /posts/:id', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: undefined });
    await deletePost('p1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/posts/p1');
  });
});

describe('posts api — searchPosts', () => {
  it('GETs /search forwarding all search params', async () => {
    const params = { q: 'food', type: 'request', category: 'Food', page: 1, limit: 10 };
    mockedApi.get.mockResolvedValueOnce({ data: { items: [] } });

    const result = await searchPosts(params);

    expect(mockedApi.get).toHaveBeenCalledWith('/search', { params });
    expect(result).toEqual({ items: [] });
  });
});
