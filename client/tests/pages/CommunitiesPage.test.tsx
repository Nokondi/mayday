import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/communities.js', () => ({
  listCommunities: vi.fn(),
  listMyCommunities: vi.fn(),
}));

vi.mock('../../src/context/AuthContext.js', () => ({ useAuth: vi.fn() }));

vi.mock('../../src/hooks/useDebounce.js', () => ({
  useDebounce: (value: string) => value,
}));

import { listCommunities, listMyCommunities } from '../../src/api/communities.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { CommunitiesPage } from '../../src/pages/CommunitiesPage.js';

const mockedListCommunities = vi.mocked(listCommunities);
const mockedListMyCommunities = vi.mocked(listMyCommunities);
const mockedUseAuth = vi.mocked(useAuth);

function makeCommunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Eastside Neighbors',
    description: 'Local community',
    location: 'Seattle',
    latitude: null,
    longitude: null,
    avatarUrl: null,
    memberCount: 5,
    myRole: null,
    myJoinRequestStatus: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function paginated(data: unknown[]) {
  return { data, total: data.length, page: 1, limit: 20, totalPages: 1 } as never;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CommunitiesPage — logged-in viewer', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false } as never);
  });

  it('lists the viewer\'s communities separately from the rest', async () => {
    const mine = makeCommunity({ id: 'mine', name: 'My Community', myRole: 'MEMBER' });
    const other = makeCommunity({ id: 'other', name: 'Other Community' });
    mockedListMyCommunities.mockResolvedValue([mine] as never);
    mockedListCommunities.mockResolvedValue(paginated([mine, other]));

    renderPage();

    expect(
      await screen.findByRole('heading', { name: /your communities/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my community/i })).toHaveAttribute(
      'href',
      '/communities/mine',
    );
    expect(screen.getByRole('link', { name: /other community/i })).toHaveAttribute(
      'href',
      '/communities/other',
    );
  });

  it('shows the New Community button', async () => {
    mockedListMyCommunities.mockResolvedValue([] as never);
    mockedListCommunities.mockResolvedValue(paginated([]));

    renderPage();

    expect(
      await screen.findByRole('link', { name: /new community/i }),
    ).toHaveAttribute('href', '/communities/new');
  });
});

describe('CommunitiesPage — anonymous visitor', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false } as never);
  });

  it('lists all communities without fetching the viewer\'s memberships', async () => {
    mockedListCommunities.mockResolvedValue(
      paginated([makeCommunity({ id: 'c1', name: 'Eastside Neighbors' })]),
    );

    renderPage();

    // Cards still link to the detail route; the router's ProtectedRoute
    // redirects logged-out visitors to /login from there.
    expect(
      await screen.findByRole('link', { name: /eastside neighbors/i }),
    ).toHaveAttribute('href', '/communities/c1');

    expect(mockedListMyCommunities).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: /your communities/i }),
    ).not.toBeInTheDocument();
    // Creating a community requires an account, so the button is hidden.
    expect(
      screen.queryByRole('link', { name: /new community/i }),
    ).not.toBeInTheDocument();
  });

  it('does not fetch the directory until the auth check settles', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true } as never);
    renderPage();

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(mockedListCommunities).not.toHaveBeenCalled();
  });
});
