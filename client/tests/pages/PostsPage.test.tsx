import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/posts.js', () => ({ getPosts: vi.fn() }));
vi.mock('../../src/api/communities.js', () => ({ listMyCommunities: vi.fn() }));
vi.mock('../../src/context/AuthContext.js', () => ({ useAuth: vi.fn() }));

import { PostsPage } from '../../src/pages/PostsPage.js';
import { getPosts } from '../../src/api/posts.js';
import { listMyCommunities } from '../../src/api/communities.js';
import { useAuth } from '../../src/context/AuthContext.js';

const mockedGetPosts = vi.mocked(getPosts);
const mockedListMyCommunities = vi.mocked(listMyCommunities);
const mockedUseAuth = vi.mocked(useAuth);

function authState(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'u1', name: 'Alice' },
    isLoading: false,
    ...overrides,
  } as never;
}

// Minimal paginated payload; the page reads data/total/page/totalPages.
function postsResult(overrides: Record<string, unknown> = {}) {
  return { data: [], total: 0, page: 1, totalPages: 1, ...overrides } as never;
}

// Exposes the current URL search string so tests can assert URL sync.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

function renderPage(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <PostsPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPosts.mockResolvedValue(postsResult());
  mockedListMyCommunities.mockResolvedValue([] as never);
  mockedUseAuth.mockReturnValue(authState());
});

describe('PostsPage — collapsible controls', () => {
  it('hides the search/filter controls by default', async () => {
    renderPage();
    await waitFor(() => expect(mockedGetPosts).toHaveBeenCalled());
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /filter by type/i })).not.toBeInTheDocument();
  });

  it('reveals the search bar and filters when the toggle is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /search & filters/i }));
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filter by type/i })).toBeInTheDocument();
  });

  it('defaults to chronological order (no sort param in the URL)', async () => {
    renderPage();
    await waitFor(() => expect(mockedGetPosts).toHaveBeenCalled());
    expect(mockedGetPosts).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'recent' }),
    );
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });
});

describe('PostsPage — active filter chips', () => {
  it('renders a chip for a filter provided in the initial URL', async () => {
    renderPage('/?type=REQUEST');
    expect(await screen.findByText('Requests')).toBeInTheDocument();
  });

  it('adds a chip and syncs the URL when a filter is selected', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /search & filters/i }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter by type/i }),
      'OFFER',
    );
    // Scope to the chip's remove button — the filter dropdown also has an
    // "Offers" <option>, so a bare text query would be ambiguous.
    expect(
      await screen.findByRole('button', { name: /remove offers/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('type=OFFER'),
    );
  });

  it('removes the filter and clears the URL when a chip is dismissed', async () => {
    const user = userEvent.setup();
    renderPage('/?type=REQUEST');
    const chipLabel = await screen.findByText('Requests');
    const chip = chipLabel.closest('span') as HTMLElement;
    await user.click(within(chip).getByRole('button', { name: /remove requests/i }));
    await waitFor(() =>
      expect(screen.queryByText('Requests')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('search')).not.toHaveTextContent('type=REQUEST');
  });
});

describe('PostsPage — anonymous browsing', () => {
  it('fetches posts but not the viewer\'s communities when logged out', async () => {
    mockedUseAuth.mockReturnValue(authState({ user: null }));
    renderPage();
    await waitFor(() => expect(mockedGetPosts).toHaveBeenCalled());
    expect(mockedListMyCommunities).not.toHaveBeenCalled();
  });

  it('hides the community/friends filter when logged out', async () => {
    mockedUseAuth.mockReturnValue(authState({ user: null }));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /search & filters/i }));
    expect(screen.getByRole('combobox', { name: /filter by type/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /filter by community or friends/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the community/friends filter when logged in', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /search & filters/i }));
    expect(
      screen.getByRole('combobox', { name: /filter by community or friends/i }),
    ).toBeInTheDocument();
  });

  it('waits for the auth check before fetching posts', async () => {
    mockedUseAuth.mockReturnValue(authState({ user: null, isLoading: true }));
    renderPage();
    // The query is disabled while auth is resolving, so nothing fires.
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(mockedGetPosts).not.toHaveBeenCalled();
  });
});
