import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
import { getComments } from '../../../src/api/comments.js';
import { getPostMatches } from '../../../src/api/posts.js';
import { PostDetailContent } from '../../../src/components/posts/PostDetailContent.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetComments = vi.mocked(getComments);
const mockedGetPostMatches = vi.mocked(getPostMatches);

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
    commentCount: 3,
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

function renderContent(
  post: PostWithAuthor,
  props: Partial<Parameters<typeof PostDetailContent>[0]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PostDetailContent post={post} variant="card" {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth({ id: 'u2', email: 'b@b.com', name: 'Bob', role: 'USER', avatarUrl: null });
  mockedGetComments.mockResolvedValue([] as never);
  mockedGetPostMatches.mockResolvedValue([] as never);
});

describe('PostDetailContent — card variant sections', () => {
  it('starts with both sections collapsed and fetches nothing', () => {
    renderContent(makePost());

    expect(screen.getByRole('button', { name: /comments \(3\)/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /matching offers/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(mockedGetComments).not.toHaveBeenCalled();
    expect(mockedGetPostMatches).not.toHaveBeenCalled();
  });

  it('opens the comments section on click and closes it on a second click', async () => {
    const user = userEvent.setup();
    renderContent(makePost());

    const toggle = screen.getByRole('button', { name: /comments \(3\)/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(mockedGetComments).toHaveBeenCalled());

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
  });

  it('fetches and renders matches only when the section is opened', async () => {
    const user = userEvent.setup();
    mockedGetPostMatches.mockResolvedValue([
      makePost({ id: 'm1', type: 'OFFER', title: 'I can help' }) as never,
    ]);
    renderContent(makePost());

    expect(mockedGetPostMatches).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /matching offers/i }));

    expect(await screen.findByText('I can help')).toBeInTheDocument();
    expect(mockedGetPostMatches).toHaveBeenCalledWith('p1');
  });

  it('offers no matching section for events or comms posts', () => {
    renderContent(makePost({ type: 'COMMS' }));
    expect(screen.queryByRole('button', { name: /matching/i })).not.toBeInTheDocument();
  });

  it('renders a collapse control that calls onCollapse', async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    renderContent(makePost(), { onCollapse });

    await user.click(screen.getByRole('button', { name: /collapse post/i }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('shows the collapse control to anonymous viewers', () => {
    setAuth(null);
    renderContent(makePost(), { onCollapse: vi.fn() });
    expect(screen.getByRole('button', { name: /collapse post/i })).toBeInTheDocument();
  });
});

describe('PostDetailContent — page variant', () => {
  it('renders tabs with Comments active by default', async () => {
    renderContent(makePost(), { variant: 'page' });

    expect(screen.getByRole('tab', { name: /comments \(3\)/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(mockedGetComments).toHaveBeenCalled());
  });

  it('does not fetch matches until the related tab is selected', async () => {
    const user = userEvent.setup();
    renderContent(makePost(), { variant: 'page' });

    expect(mockedGetPostMatches).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: /matching offers/i }));
    await waitFor(() => expect(mockedGetPostMatches).toHaveBeenCalledWith('p1'));
  });
});
