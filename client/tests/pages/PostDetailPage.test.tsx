import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/api/posts.js', () => ({
  getPost: vi.fn(),
  getPostMatches: vi.fn(),
  deletePost: vi.fn(),
  reopenPost: vi.fn(),
  fulfillPost: vi.fn(),
  searchFulfillers: vi.fn(),
}));

vi.mock('../../src/api/messages.js', () => ({
  startConversation: vi.fn(),
}));

vi.mock('../../src/api/users.js', () => ({
  createReport: vi.fn(),
}));

import { useAuth } from '../../src/context/AuthContext.js';
import { getPost, getPostMatches, reopenPost } from '../../src/api/posts.js';
import { PostDetailPage } from '../../src/pages/PostDetailPage.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetPost = vi.mocked(getPost);
const mockedGetPostMatches = vi.mocked(getPostMatches);
const mockedReopenPost = vi.mocked(reopenPost);

function setAuth(user: { id: string; email: string; name: string; role: string; avatarUrl: string | null } | null) {
  mockedUseAuth.mockReturnValue({
    user,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Need groceries',
    description: 'Running low on food',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    communityId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    community: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // jsdom doesn't implement HTMLDialogElement.showModal / .close natively.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/posts/p1']}>
        <Routes>
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/posts" element={<div>POSTS LIST</div>} />
          <Route path="/messages" element={<div>MESSAGES</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPostMatches.mockResolvedValue([]);
});

describe('PostDetailPage — fulfill button visibility', () => {
  it('shows "Mark as Fulfilled" button when the owner views an OPEN post', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByRole('button', { name: /mark as fulfilled/i })).toBeInTheDocument();
  });

  it('shows "Mark as Fulfilled" button when an admin views an OPEN post', async () => {
    setAuth({ id: 'admin1', email: 'admin@b.com', name: 'Admin', role: 'ADMIN', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByRole('button', { name: /mark as fulfilled/i })).toBeInTheDocument();
  });

  it('does not show "Mark as Fulfilled" button for non-owner non-admin users', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByText('Need groceries');
    expect(screen.queryByRole('button', { name: /mark as fulfilled/i })).not.toBeInTheDocument();
  });

  it('does not show "Mark as Fulfilled" button when the post is already FULFILLED', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'FULFILLED', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByText('Need groceries');
    expect(screen.queryByRole('button', { name: /mark as fulfilled/i })).not.toBeInTheDocument();
  });
});

describe('PostDetailPage — fulfillment display', () => {
  it('shows "Fulfilled by" section with linked user names', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      status: 'FULFILLED',
      authorId: 'u1',
      fulfillments: [
        { id: 'f1', postId: 'p1', name: 'Bob', userId: 'u2', organizationId: null, createdAt: '2020-01-02T00:00:00Z' },
      ],
    }) as never);
    renderPage();

    expect(await screen.findByText('Fulfilled by')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Bob' });
    expect(link).toHaveAttribute('href', '/profile/u2');
  });

  it('shows "Fulfilled by" section with linked organization names', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      status: 'FULFILLED',
      authorId: 'u1',
      fulfillments: [
        { id: 'f2', postId: 'p1', name: 'Red Cross', userId: null, organizationId: 'o1', createdAt: '2020-01-02T00:00:00Z' },
      ],
    }) as never);
    renderPage();

    expect(await screen.findByText('Fulfilled by')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Red Cross' });
    expect(link).toHaveAttribute('href', '/organizations/o1');
  });

  it('shows free-text fulfiller names without links', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      status: 'FULFILLED',
      authorId: 'u1',
      fulfillments: [
        { id: 'f3', postId: 'p1', name: 'A kind neighbor', userId: null, organizationId: null, createdAt: '2020-01-02T00:00:00Z' },
      ],
    }) as never);
    renderPage();

    expect(await screen.findByText('A kind neighbor')).toBeInTheDocument();
    // It should be plain text, not a link
    expect(screen.queryByRole('link', { name: 'A kind neighbor' })).not.toBeInTheDocument();
  });

  it('shows multiple fulfillers together', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      status: 'FULFILLED',
      authorId: 'u1',
      fulfillments: [
        { id: 'f1', postId: 'p1', name: 'Carol', userId: 'u3', organizationId: null, createdAt: '2020-01-02T00:00:00Z' },
        { id: 'f2', postId: 'p1', name: 'Red Cross', userId: null, organizationId: 'o1', createdAt: '2020-01-02T00:00:00Z' },
        { id: 'f3', postId: 'p1', name: 'A neighbor', userId: null, organizationId: null, createdAt: '2020-01-02T00:00:00Z' },
      ],
    }) as never);
    renderPage();

    expect(await screen.findByText('Fulfilled by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Carol' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Red Cross' })).toBeInTheDocument();
    expect(screen.getByText('A neighbor')).toBeInTheDocument();
  });

  it('does not show "Fulfilled by" section for OPEN posts', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN' }) as never);
    renderPage();

    await screen.findByText('Need groceries');
    expect(screen.queryByText('Fulfilled by')).not.toBeInTheDocument();
  });
});

describe('PostDetailPage — reopen button', () => {
  it('shows "Reopen" button when the owner views a FULFILLED post', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'FULFILLED', authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByRole('button', { name: /reopen/i })).toBeInTheDocument();
  });

  it('does not show "Reopen" button for non-owner non-admin users', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'FULFILLED', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByText('Need groceries');
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('does not show "Reopen" button for OPEN posts', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByText('Need groceries');
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('calls reopenPost when the reopen button is clicked', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'FULFILLED', authorId: 'u1' }) as never);
    mockedReopenPost.mockResolvedValueOnce(makePost({ status: 'OPEN' }) as never);
    renderPage();

    const reopenBtn = await screen.findByRole('button', { name: /reopen/i });
    await user.click(reopenBtn);

    await waitFor(() => {
      expect(mockedReopenPost).toHaveBeenCalledWith('p1');
    });
  });
});

describe('PostDetailPage — fulfill modal integration', () => {
  it('opens the fulfill modal when "Mark as Fulfilled" is clicked', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    await user.click(await screen.findByRole('button', { name: /mark as fulfilled/i }));

    // The modal should now be visible with its input
    expect(await screen.findByPlaceholderText(/type a name/i)).toBeInTheDocument();
  });
});
