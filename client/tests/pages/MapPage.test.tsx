import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';

vi.mock('../../src/api/posts.js', () => ({ getPosts: vi.fn() }));
vi.mock('../../src/api/communities.js', () => ({ listMyCommunities: vi.fn() }));
vi.mock('../../src/hooks/useGeolocation.js', () => ({
  useGeolocation: () => ({ latitude: 1, longitude: 2, loading: false }),
}));

// Stub the map: a button that selects every post currently passed to it,
// so we can exercise MapPage's selection + reconcile logic without Leaflet.
vi.mock('../../src/components/map/MapView.js', () => ({
  MapView: (props: { posts: PostWithAuthor[]; onSelectPosts: (p: PostWithAuthor[]) => void }) => (
    <button type="button" onClick={() => props.onSelectPosts(props.posts)}>
      select-all
    </button>
  ),
}));

import { getPosts } from '../../src/api/posts.js';
import { listMyCommunities } from '../../src/api/communities.js';
import { MapPage } from '../../src/pages/MapPage.js';

const mockedGetPosts = vi.mocked(getPosts);
const mockedListMyCommunities = vi.mocked(listMyCommunities);

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    sharedWithFriends: false,
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: 'Somewhere',
    latitude: 34.7,
    longitude: -92.3,
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" defaultLocale="en">
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListMyCommunities.mockResolvedValue([]);
});

describe('MapPage — selection panel', () => {
  const offer = makePost({ id: 'offer', type: 'OFFER', title: 'Spare blankets' });
  const request = makePost({ id: 'request', type: 'REQUEST', title: 'Need groceries' });

  it('shows the selected posts in the panel', async () => {
    mockedGetPosts.mockResolvedValue({ data: [request, offer], total: 2 } as never);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /select-all/i }));

    expect(screen.getByRole('heading', { name: /2 posts here/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /need groceries/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spare blankets/i })).toBeInTheDocument();
  });

  it('drops a selected post from the panel once it leaves the fetched result set', async () => {
    // Without a type filter both posts are returned; filtering to Requests
    // drops the offer from the next fetch.
    mockedGetPosts.mockImplementation((params) =>
      Promise.resolve(
        params?.type === 'REQUEST'
          ? ({ data: [request], total: 1 } as never)
          : ({ data: [request, offer], total: 2 } as never),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /select-all/i }));
    expect(screen.getByRole('heading', { name: /2 posts here/i })).toBeInTheDocument();

    // Narrow the type filter → refetch returns only the request.
    await user.selectOptions(screen.getByLabelText(/filter by type/i), 'REQUEST');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /1 post here/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: /spare blankets/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /need groceries/i })).toBeInTheDocument();
  });
});
