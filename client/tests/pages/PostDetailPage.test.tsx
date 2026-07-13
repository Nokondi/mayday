import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
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

vi.mock('../../src/api/comments.js', () => ({
  getComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { useAuth } from '../../src/context/AuthContext.js';
import { getComments } from '../../src/api/comments.js';
import { getPost, getPostMatches, reopenPost, deletePost } from '../../src/api/posts.js';
import { startConversation } from '../../src/api/messages.js';
import { createReport } from '../../src/api/users.js';
import { PostDetailPage } from '../../src/pages/PostDetailPage.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetPost = vi.mocked(getPost);
const mockedGetPostMatches = vi.mocked(getPostMatches);
const mockedReopenPost = vi.mocked(reopenPost);
const mockedDeletePost = vi.mocked(deletePost);
const mockedCreateReport = vi.mocked(createReport);
const mockedStartConversation = vi.mocked(startConversation);

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
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    commentCount: 0,
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
    communities: [],
    ...overrides,
  };
}

function MessagesProbe() {
  const location = useLocation();
  const draft = (location.state as { draft?: string } | null)?.draft ?? '';
  return (
    <div>
      <div>MESSAGES</div>
      <div data-testid="messages-search">{location.search}</div>
      <div data-testid="messages-draft">{draft}</div>
    </div>
  );
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
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/posts/p1']}>
          <Routes>
            <Route path="/posts/:id" element={<PostDetailPage />} />
            <Route path="/" element={<div>POSTS LIST</div>} />
            <Route path="/messages" element={<MessagesProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

const mockedGetComments = vi.mocked(getComments);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPostMatches.mockResolvedValue([]);
  mockedGetComments.mockResolvedValue([]);
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

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /mark as fulfilled/i })).not.toBeInTheDocument();
  });

  it('does not show "Mark as Fulfilled" button when the post is already FULFILLED', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'FULFILLED', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /mark as fulfilled/i })).not.toBeInTheDocument();
  });
});

describe('PostDetailPage — comments / related tabs', () => {
  it('defaults to the Comments tab and shows the comment count in its label', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1', commentCount: 2 }) as never);
    renderPage();

    expect(await screen.findByRole('tab', { name: /comments \(2\)/i })).toBeInTheDocument();
    // The comments tab is selected by default, so its composer is present.
    expect(await screen.findByPlaceholderText(/add a comment/i)).toBeInTheDocument();
  });

  it('does not offer a moderator delete on another user\'s comment to a post owner who is not an admin', async () => {
    // u1 owns the post but is a plain USER; the comment is by u2.
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1', commentCount: 1 }) as never);
    mockedGetComments.mockResolvedValue([
      {
        id: 'c1', postId: 'p1', authorId: 'u2', body: 'u2 comment',
        editedAt: null, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z',
        author: { id: 'u2', name: 'Bob', bio: null, location: null, skills: [], avatarUrl: null, links: null, createdAt: '2020-01-01T00:00:00Z' },
      },
    ] as never);
    renderPage();

    const commentRoot = (await screen.findByText('u2 comment')).closest('div')!;
    expect(within(commentRoot).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(within(commentRoot).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('offers a moderator delete on another user\'s comment to a site admin', async () => {
    setAuth({ id: 'admin1', email: 'admin@b.com', name: 'Admin', role: 'ADMIN', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1', commentCount: 1 }) as never);
    mockedGetComments.mockResolvedValue([
      {
        id: 'c1', postId: 'p1', authorId: 'u2', body: 'u2 comment',
        editedAt: null, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z',
        author: { id: 'u2', name: 'Bob', bio: null, location: null, skills: [], avatarUrl: null, links: null, createdAt: '2020-01-01T00:00:00Z' },
      },
    ] as never);
    renderPage();

    const commentRoot = (await screen.findByText('u2 comment')).closest('div')!;
    expect(within(commentRoot).getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('switches to the related-posts tab and renders matches', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ type: 'REQUEST', authorId: 'u1' }) as never);
    mockedGetPostMatches.mockResolvedValue([
      makePost({ id: 'm1', type: 'OFFER', title: 'I can help' }) as never,
    ]);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    await user.click(screen.getByRole('tab', { name: /matching offers/i }));

    expect(await screen.findByText('I can help')).toBeInTheDocument();
    // The composer from the comments tab is no longer shown.
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
  });
});

describe('PostDetailPage — edit button', () => {
  it('shows an Edit link to the edit page when the owner views the post', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    const editLink = await screen.findByRole('link', { name: /edit/i });
    expect(editLink).toHaveAttribute('href', '/posts/p1/edit');
  });

  it('shows the Edit link for an admin viewing someone else\'s post', async () => {
    setAuth({ id: 'admin1', email: 'admin@b.com', name: 'Admin', role: 'ADMIN', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    expect(await screen.findByRole('link', { name: /edit/i })).toBeInTheDocument();
  });

  it('does not show the Edit link for non-owner non-admin users', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
  });
});

describe('PostDetailPage — type chip', () => {
  it('shows an orange "Request" chip below a plain title for request posts', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ type: 'REQUEST' }) as never);
    renderPage();

    // The heading is the bare title again.
    expect(
      await screen.findByRole('heading', { name: 'Need groceries' }),
    ).toBeInTheDocument();
    const chip = screen.getByText('Request');
    expect(chip).toHaveClass('rounded-full', 'bg-orange-100', 'text-orange-700');
  });

  it('shows a green "Offer" chip for offer posts', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ type: 'OFFER' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: 'Need groceries' });
    const chip = screen.getByText('Offer');
    expect(chip).toHaveClass('rounded-full', 'bg-green-100', 'text-green-700');
  });
});

describe('PostDetailPage — author header', () => {
  it('shows the author name as a link to their profile', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    const authorLink = await screen.findByRole('link', { name: 'Alice' });
    expect(authorLink).toHaveAttribute('href', '/profile/u1');
  });

  it('renders the author avatar image when one is set', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      authorId: 'u1',
      author: {
        id: 'u1',
        name: 'Alice',
        bio: null,
        location: null,
        skills: [],
        avatarUrl: 'https://cdn.example.com/alice.png',
        createdAt: '2020-01-01T00:00:00Z',
      },
    }) as never);
    const { container } = renderPage();

    await screen.findByRole('link', { name: 'Alice' });
    expect(
      container.querySelector('img[src="https://cdn.example.com/alice.png"]'),
    ).toBeInTheDocument();
  });

  it('renders a placeholder instead of an image when the author has no avatar', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    const { container } = renderPage();

    await screen.findByRole('link', { name: 'Alice' });
    // No post images and no avatar → no <img> anywhere in the card.
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('shows the organization as a secondary link when the post is on behalf of one', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({
      authorId: 'u1',
      organizationId: 'o1',
      organization: { id: 'o1', name: 'Red Cross', avatarUrl: null },
    }) as never);
    renderPage();

    expect(await screen.findByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      '/profile/u1',
    );
    expect(screen.getByRole('link', { name: /red cross/i })).toHaveAttribute(
      'href',
      '/organizations/o1',
    );
  });
});

describe('PostDetailPage — icon-only edit and delete controls', () => {
  it('renders Edit and Delete as icon-only controls named via aria-label, with no visible text', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    const editLink = await screen.findByRole('link', { name: /edit/i });
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    // The accessible name comes from aria-label; the controls contain only icons.
    expect(editLink).toHaveTextContent('');
    expect(deleteBtn).toHaveTextContent('');
  });

  it('calls deletePost and navigates home when the delete button is clicked', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    mockedDeletePost.mockResolvedValueOnce(undefined as never);
    renderPage();

    await user.click(await screen.findByRole('button', { name: /delete/i }));

    await waitFor(() => expect(mockedDeletePost).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText('POSTS LIST')).toBeInTheDocument();
  });

  it('does not show the Delete button for non-owner non-admin users', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
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

    await screen.findByRole('heading', { name: /need groceries/i });
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

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('does not show "Reopen" button for OPEN posts', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ status: 'OPEN', authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
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

describe('PostDetailPage — report flag', () => {
  it('shows a compact flag (icon-only) in the corner — not a text Report button — for non-owners', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    const flag = await screen.findByRole('button', { name: /report post/i });
    expect(flag).toBeInTheDocument();
    // The old text-style Report button is gone.
    expect(screen.queryByRole('button', { name: /^report$/i })).not.toBeInTheDocument();
  });

  it('is hidden for the post\'s author', async () => {
    setAuth({ id: 'u1', email: 'a@b.com', name: 'Alice', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /report post/i })).not.toBeInTheDocument();
  });

  it('is hidden when no one is logged in', async () => {
    setAuth(null);
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    renderPage();

    await screen.findByRole('heading', { name: /need groceries/i });
    expect(screen.queryByRole('button', { name: /report post/i })).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog instead of submitting immediately', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /report post/i }));

    // The confirmation dialog is shown; no report submitted yet.
    expect(await screen.findByRole('heading', { name: /report this post\?/i })).toBeInTheDocument();
    expect(mockedCreateReport).not.toHaveBeenCalled();
  });

  it('cancels without submitting when the Cancel button is clicked', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /report post/i }));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(mockedCreateReport).not.toHaveBeenCalled();
    // The confirmation heading should no longer be in the accessibility tree once the dialog closes.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /report this post\?/i })).not.toBeInTheDocument(),
    );
  });

  it('submits a report tied to the post only after confirmation', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    mockedCreateReport.mockResolvedValueOnce({ id: 'r1' } as never);

    const user = userEvent.setup();
    renderPage();

    // Open dialog.
    await user.click(await screen.findByRole('button', { name: /report post/i }));
    // Confirm — scope to the dialog since the flag in the post corner shares the "Report post" name.
    const dialog = await screen.findByRole('dialog', { name: /report this post\?/i });
    await user.click(within(dialog).getByRole('button', { name: /^report post$/i }));

    await waitFor(() => expect(mockedCreateReport).toHaveBeenCalled());
    expect(mockedCreateReport.mock.calls[0][0]).toEqual({
      reason: 'Inappropriate content',
      postId: 'p1',
    });
  });

  it('includes the reporter\'s additional details in the submitted report', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    mockedCreateReport.mockResolvedValueOnce({ id: 'r1' } as never);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /report post/i }));
    const dialog = await screen.findByRole('dialog', { name: /report this post\?/i });
    await user.type(
      within(dialog).getByLabelText(/additional details/i),
      'This is a phishing link.',
    );
    await user.click(within(dialog).getByRole('button', { name: /^report post$/i }));

    await waitFor(() => expect(mockedCreateReport).toHaveBeenCalled());
    expect(mockedCreateReport.mock.calls[0][0]).toEqual({
      reason: 'Inappropriate content',
      postId: 'p1',
      details: 'This is a phishing link.',
    });
  });

  it('trims whitespace-only details back to an absent field', async () => {
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(makePost({ authorId: 'u1' }) as never);
    mockedCreateReport.mockResolvedValueOnce({ id: 'r1' } as never);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /report post/i }));
    const dialog = await screen.findByRole('dialog', { name: /report this post\?/i });
    await user.type(within(dialog).getByLabelText(/additional details/i), '   ');
    await user.click(within(dialog).getByRole('button', { name: /^report post$/i }));

    await waitFor(() => expect(mockedCreateReport).toHaveBeenCalled());
    const call = mockedCreateReport.mock.calls[0][0];
    expect(call).toEqual({ reason: 'Inappropriate content', postId: 'p1' });
    expect(call).not.toHaveProperty('details', expect.any(String));
  });
});

describe('PostDetailPage — Contact button', () => {
  it('navigates to messages with a draft pre-filled with the post title', async () => {
    const user = userEvent.setup();
    setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
    mockedGetPost.mockResolvedValueOnce(
      makePost({ authorId: 'u1', title: 'Need groceries' }) as never,
    );
    mockedStartConversation.mockResolvedValueOnce({ id: 'c1' } as never);

    renderPage();

    await user.click(await screen.findByRole('button', { name: /^contact$/i }));

    await waitFor(() =>
      expect(mockedStartConversation).toHaveBeenCalledWith({ participantId: 'u1' }),
    );

    // Navigated to /messages with the conversation in the URL and a draft in router state.
    expect(await screen.findByText('MESSAGES')).toBeInTheDocument();
    expect(screen.getByTestId('messages-search')).toHaveTextContent('?conversation=c1');
    expect(screen.getByTestId('messages-draft')).toHaveTextContent('Re: Need groceries');
  });
});
