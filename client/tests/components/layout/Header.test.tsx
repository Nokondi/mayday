import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

import { Header } from '../../../src/components/layout/Header.js';
import { useAuth } from '../../../src/context/AuthContext.js';

const mockedUseAuth = vi.mocked(useAuth);

type AuthState = Partial<ReturnType<typeof useAuth>>;

function setAuth(state: AuthState = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...state,
  } as ReturnType<typeof useAuth>);
}

function renderHeader(options: { initialPath?: string } = {}) {
  const { initialPath = '/' } = options;
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
                  <Header />
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function getDesktopNav() {
  return screen.getByRole('navigation', { name: /main navigation/i });
}

function queryMobileNav() {
  return screen.queryByRole('navigation', { name: /mobile navigation/i });
}

function queryQuickNav() {
  return screen.queryByRole('navigation', { name: /quick navigation/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header — logged-out state', () => {
  beforeEach(() => {
    setAuth({ user: null });
  });

  it('renders the brand link pointing home', () => {
    renderHeader();
    const brand = screen.getByRole('link', { name: /mayday/i });
    expect(brand).toHaveAttribute('href', '/');
  });

  it('shows About, Log in, and Sign up links in the desktop nav', () => {
    renderHeader();
    const nav = getDesktopNav();
    expect(within(nav).getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about');
    expect(within(nav).getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(within(nav).getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
  });

  it('does not render the authenticated-only links', () => {
    renderHeader();
    const nav = getDesktopNav();
    expect(within(nav).queryByRole('link', { name: /browse/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /new post/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /^messages$/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('does not render the mobile quick-nav icons when signed out', () => {
    renderHeader();
    expect(queryQuickNav()).not.toBeInTheDocument();
  });

  it('renders the decorative wave divider', () => {
    const { container } = renderHeader();
    // The WaveDivider is the only svg that stretches with preserveAspectRatio="none".
    expect(container.querySelector('svg[preserveAspectRatio="none"]')).toBeInTheDocument();
  });
});

describe('Header — logged-in state', () => {
  const user = { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null };

  beforeEach(() => {
    setAuth({ user });
  });

  it('shows the authenticated desktop nav links', () => {
    renderHeader();
    const nav = getDesktopNav();
    expect(within(nav).getByRole('link', { name: /browse/i })).toHaveAttribute('href', '/posts');
    expect(within(nav).getByRole('link', { name: /^map$/i })).toHaveAttribute('href', '/map');
    expect(within(nav).getByRole('link', { name: /orgs/i })).toHaveAttribute('href', '/organizations');
    expect(within(nav).getByRole('link', { name: /communities/i })).toHaveAttribute('href', '/communities');
    expect(within(nav).getByRole('link', { name: /new post/i })).toHaveAttribute('href', '/posts/new');
    expect(within(nav).getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/messages');
    expect(within(nav).getByRole('link', { name: /your profile/i })).toHaveAttribute(
      'href',
      '/profile/u1',
    );
    expect(within(nav).getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('does not show the logged-out-only links', () => {
    renderHeader();
    const nav = getDesktopNav();
    expect(within(nav).queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
  });

  it('does not show the Admin link for non-admin users', () => {
    renderHeader();
    expect(screen.queryByRole('link', { name: /admin panel/i })).not.toBeInTheDocument();
  });
});

describe('Header — admin link visibility', () => {
  it('renders the Admin panel link when the user has role="ADMIN"', () => {
    setAuth({ user: { id: 'admin', email: 'a@b.com', name: 'A', role: 'ADMIN', avatarUrl: null } });
    renderHeader();
    const nav = getDesktopNav();
    const admin = within(nav).getByRole('link', { name: /admin panel/i });
    expect(admin).toHaveAttribute('href', '/admin');
  });
});

describe('Header — logout flow', () => {
  it('awaits logout and then navigates to "/"', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    setAuth({
      user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null },
      logout,
    });
    const user = userEvent.setup();
    renderHeader({ initialPath: '/posts' });

    expect(screen.getByTestId('location')).toHaveTextContent('/posts');

    await user.click(within(getDesktopNav()).getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
  });
});

describe('Header — mobile menu toggle', () => {
  it('is collapsed by default', () => {
    setAuth({ user: null });
    renderHeader();
    const toggle = screen.getByRole('button', { name: /toggle menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(queryMobileNav()).not.toBeInTheDocument();
  });

  it('opens and closes the mobile nav when the toggle is clicked', async () => {
    setAuth({ user: null });
    const user = userEvent.setup();
    renderHeader();
    const toggle = screen.getByRole('button', { name: /toggle menu/i });

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(queryMobileNav()).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(queryMobileNav()).not.toBeInTheDocument();
  });

  it('renders authenticated links inside the mobile nav when a user is signed in', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null } });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));

    const mobileNav = queryMobileNav();
    expect(mobileNav).not.toBeNull();
    const nav = mobileNav as HTMLElement;
    expect(within(nav).getByRole('link', { name: /organizations/i })).toHaveAttribute(
      'href',
      '/organizations',
    );
    expect(within(nav).getByRole('link', { name: /profile/i })).toHaveAttribute(
      'href',
      '/profile/u1',
    );
    expect(within(nav).getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('renders logged-out links inside the mobile nav when no user is signed in', async () => {
    setAuth({ user: null });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));

    const mobileNav = queryMobileNav();
    expect(mobileNav).not.toBeNull();
    const nav = mobileNav as HTMLElement;
    expect(within(nav).getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(within(nav).getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
    expect(within(nav).queryByRole('link', { name: /browse/i })).not.toBeInTheDocument();
  });

  it('collapses the mobile nav when a nav link inside it is clicked', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null } });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));
    const mobileNav = queryMobileNav() as HTMLElement;
    expect(mobileNav).not.toBeNull();

    await user.click(within(mobileNav).getByRole('link', { name: /organizations/i }));

    expect(queryMobileNav()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('does not include Browse, Map, Calendar, New Post, or Messages in the mobile dropdown', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null } });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));

    const mobileNav = queryMobileNav() as HTMLElement;
    expect(within(mobileNav).queryByRole('link', { name: /browse/i })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole('link', { name: /^map$/i })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole('link', { name: /^calendar$/i })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole('link', { name: /new post/i })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole('link', { name: /^messages$/i })).not.toBeInTheDocument();
  });
});

describe('Header — mobile quick-nav icons', () => {
  const user = { id: 'u1', email: 'a@b.com', name: 'A', role: 'USER', avatarUrl: null };

  it('renders Browse, Map, Calendar, New Post, and Messages icon links when signed in', () => {
    setAuth({ user });
    renderHeader();
    const quickNav = queryQuickNav();
    expect(quickNav).not.toBeNull();
    const nav = quickNav as HTMLElement;
    expect(within(nav).getByRole('link', { name: /browse/i })).toHaveAttribute('href', '/posts');
    expect(within(nav).getByRole('link', { name: /^map$/i })).toHaveAttribute('href', '/map');
    expect(within(nav).getByRole('link', { name: /^calendar$/i })).toHaveAttribute('href', '/calendar');
    expect(within(nav).getByRole('link', { name: /new post/i })).toHaveAttribute('href', '/posts/new');
    expect(within(nav).getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/messages');
  });

  it.each([
    ['/posts', /browse/i],
    ['/map', /^map$/i],
    ['/calendar', /^calendar$/i],
    ['/posts/new', /new post/i],
    ['/messages', /^messages$/i],
  ] as const)('marks %s as the current page when active', (path, name) => {
    setAuth({ user });
    renderHeader({ initialPath: path });
    const nav = queryQuickNav() as HTMLElement;
    const link = within(nav).getByRole('link', { name });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark any quick-nav link as current when on an unrelated route', () => {
    setAuth({ user });
    renderHeader({ initialPath: '/organizations' });
    const nav = queryQuickNav() as HTMLElement;
    expect(within(nav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });
});
