import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/api/posts.js', () => ({
  getPostMatches: vi.fn(),
  deletePost: vi.fn(),
  reopenPost: vi.fn(),
  fulfillPost: vi.fn(),
  searchFulfillers: vi.fn(),
}));

vi.mock('../../../src/api/messages.js', () => ({
  startConversation: vi.fn(),
}));

vi.mock('../../../src/api/users.js', () => ({
  createReport: vi.fn(),
}));

vi.mock('../../../src/api/comments.js', () => ({
  getComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { useAuth } from '../../../src/context/AuthContext.js';
import { PostList } from '../../../src/components/posts/PostList.js';

const mockedUseAuth = vi.mocked(useAuth);

function setAuth(
  user: { id: string; email: string; name: string; role: string; avatarUrl: string | null } | null,
) {
  mockedUseAuth.mockReturnValue({
    user,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    sharedWithFriends: false,
    title: 'Need help',
    description: 'Short description',
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
      links: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    communities: [],
    ...overrides,
  };
}

function renderList(posts: PostWithAuthor[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PostList posts={posts} />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
});

describe('PostList', () => {
  it('renders an empty-state message when there are no posts', () => {
    renderList([]);
    expect(screen.getByText(/no posts found\. try adjusting your filters/i)).toBeInTheDocument();
  });

  it('does not render any post cards when empty', () => {
    renderList([]);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders one PostCard per post when posts are provided', () => {
    renderList([
      makePost({ id: 'p1', title: 'First' }),
      makePost({ id: 'p2', title: 'Second' }),
      makePost({ id: 'p3', title: 'Third' }),
    ]);

    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Third' })).toBeInTheDocument();
  });

  it('renders each card as a collapsed expandable button, not a link', () => {
    renderList([makePost({ id: 'p1', title: 'First' })]);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument();
  });

  it('does not render the empty-state message when posts are present', () => {
    renderList([makePost()]);
    expect(screen.queryByText(/no posts found/i)).not.toBeInTheDocument();
  });
});

describe('PostList — in-place expansion', () => {
  it('expands a post in place when its card is clicked', async () => {
    const user = userEvent.setup();
    renderList([
      makePost({ id: 'p1', title: 'First', description: 'First description' }),
      makePost({ id: 'p2', title: 'Second' }),
    ]);

    await user.click(screen.getByRole('button', { name: /first/i }));

    // Detail-only affordances appear (Contact + collapse), still on the page.
    expect(screen.getByRole('button', { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collapse post/i })).toBeInTheDocument();
    // The other card stays compact.
    expect(screen.getByRole('button', { name: /second/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps comments and matching posts hidden until requested', async () => {
    const user = userEvent.setup();
    renderList([makePost({ id: 'p1', title: 'First', commentCount: 2 })]);

    await user.click(screen.getByRole('button', { name: /first/i }));

    const commentsToggle = screen.getByRole('button', { name: /comments \(2\)/i });
    const matchesToggle = screen.getByRole('button', { name: /matching offers/i });
    expect(commentsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(matchesToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
  });

  it('collapses the post back to a compact card', async () => {
    const user = userEvent.setup();
    renderList([makePost({ id: 'p1', title: 'First' })]);

    await user.click(screen.getByRole('button', { name: /first/i }));
    await user.click(screen.getByRole('button', { name: /collapse post/i }));

    expect(screen.queryByRole('button', { name: /collapse post/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /first/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('expanding a second post collapses the first', async () => {
    const user = userEvent.setup();
    renderList([
      makePost({ id: 'p1', title: 'First' }),
      makePost({ id: 'p2', title: 'Second' }),
    ]);

    await user.click(screen.getByRole('button', { name: /first/i }));
    await user.click(screen.getByRole('button', { name: /second/i }));

    // Only one collapse control exists: the newly expanded card's.
    expect(screen.getAllByRole('button', { name: /collapse post/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /first/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
