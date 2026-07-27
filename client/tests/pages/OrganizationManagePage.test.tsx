import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/api/organizations.js', () => ({
  getOrganization: vi.fn(),
  getOrganizationInvites: vi.fn(),
  inviteToOrganization: vi.fn(),
  revokeInvite: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
  updateOrganization: vi.fn(),
  uploadOrganizationAvatar: vi.fn(),
  transferOrganizationOwnership: vi.fn(),
}));

vi.mock('../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

import { OrganizationManagePage } from '../../src/pages/OrganizationManagePage.js';
import {
  getOrganization,
  getOrganizationInvites,
  transferOrganizationOwnership,
} from '../../src/api/organizations.js';
import { useAuth } from '../../src/context/AuthContext.js';

const mockedGetOrganization = vi.mocked(getOrganization);
const mockedGetOrganizationInvites = vi.mocked(getOrganizationInvites);
const mockedTransferOrganizationOwnership = vi.mocked(transferOrganizationOwnership);
const mockedUseAuth = vi.mocked(useAuth);

const OWNER_ID = 'owner-1';
const HEIR_ID = 'heir-2';
const ORG_ID = 'o1';

function orgFixture(myRole: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return {
    id: ORG_ID,
    name: 'Food Pantry',
    description: null,
    location: null,
    latitude: null,
    longitude: null,
    avatarUrl: null,
    links: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    memberCount: 2,
    myRole,
    members: [
      {
        id: 'mem-1',
        organizationId: ORG_ID,
        userId: OWNER_ID,
        role: 'OWNER',
        joinedAt: '2026-01-01',
        user: { id: OWNER_ID, name: 'Owner', avatarUrl: null },
      },
      {
        id: 'mem-2',
        organizationId: ORG_ID,
        userId: HEIR_ID,
        role: 'ADMIN',
        joinedAt: '2026-01-02',
        user: { id: HEIR_ID, name: 'Dana Park', avatarUrl: null },
      },
    ],
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });

  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/organizations/${ORG_ID}/manage`]}>
          <Routes>
            <Route path="/organizations/:id/manage" element={<OrganizationManagePage />} />
            <Route path="/organizations/:id" element={<div>DETAIL</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({
    user: { id: OWNER_ID, email: 'owner@example.com', name: 'Owner', role: 'USER', avatarUrl: null },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
  mockedGetOrganizationInvites.mockResolvedValue([] as never);
});

describe('OrganizationManagePage — transfer ownership', () => {
  it('shows the transfer-ownership section to OWNERs', async () => {
    mockedGetOrganization.mockResolvedValueOnce(orgFixture('OWNER') as never);
    renderPage();
    await screen.findByRole('heading', { name: /transfer ownership/i });
  });

  it('hides the transfer-ownership section from ADMINs', async () => {
    mockedGetOrganization.mockResolvedValueOnce(orgFixture('ADMIN') as never);
    renderPage();
    // The members section heading is the cue that the page finished rendering.
    await screen.findByRole('heading', { name: /^members$/i });
    expect(
      screen.queryByRole('heading', { name: /transfer ownership/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the picker dialog and calls the API with the chosen heir', async () => {
    mockedGetOrganization.mockResolvedValueOnce(orgFixture('OWNER') as never);
    mockedTransferOrganizationOwnership.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderPage();

    const trigger = await screen.findByRole('button', { name: /transfer ownership/i });
    await user.click(trigger);

    const heir = await screen.findByRole('radio', { name: /dana park/i });
    await user.click(heir);

    await user.click(screen.getByRole('button', { name: /make dana park owner/i }));

    await waitFor(() =>
      expect(mockedTransferOrganizationOwnership).toHaveBeenCalledWith(ORG_ID, {
        newOwnerId: HEIR_ID,
      }),
    );
  });
});
