import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/organizations.js', () => ({
  listOrganizations: vi.fn(),
}));

vi.mock('../../src/context/AuthContext.js', () => ({ useAuth: vi.fn() }));

vi.mock('../../src/hooks/useDebounce.js', () => ({
  useDebounce: (value: string) => value,
}));

import { listOrganizations } from '../../src/api/organizations.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { OrganizationsPage } from '../../src/pages/OrganizationsPage.js';

const mockedListOrganizations = vi.mocked(listOrganizations);
const mockedUseAuth = vi.mocked(useAuth);

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    name: 'Helping Hands',
    description: 'Mutual aid org',
    location: 'Little Rock',
    latitude: null,
    longitude: null,
    avatarUrl: null,
    memberCount: 4,
    myRole: null,
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
          <OrganizationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrganizationsPage', () => {
  it('lists organizations for a logged-in viewer', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false } as never);
    mockedListOrganizations.mockResolvedValue(
      paginated([makeOrg({ myRole: 'OWNER' })]),
    );

    renderPage();

    expect(
      await screen.findByRole('link', { name: /helping hands/i }),
    ).toHaveAttribute('href', '/organizations/o1');
    expect(screen.getByText(/1 organization found/i)).toBeInTheDocument();
  });

  it('lists organizations for an anonymous visitor', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false } as never);
    mockedListOrganizations.mockResolvedValue(paginated([makeOrg()]));

    renderPage();

    // Cards still link to the detail route; the router's ProtectedRoute
    // redirects logged-out visitors to /login from there.
    expect(
      await screen.findByRole('link', { name: /helping hands/i }),
    ).toHaveAttribute('href', '/organizations/o1');
  });

  it('does not fetch the directory until the auth check settles', async () => {
    mockedUseAuth.mockReturnValue({ user: null, isLoading: true } as never);
    renderPage();

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(mockedListOrganizations).not.toHaveBeenCalled();
  });
});
