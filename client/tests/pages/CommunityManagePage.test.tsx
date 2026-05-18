import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/api/communities.js', () => ({
  getCommunity: vi.fn(),
  getCommunityInvites: vi.fn(),
  getCommunityJoinRequests: vi.fn(),
  inviteToCommunity: vi.fn(),
  revokeCommunityInvite: vi.fn(),
  removeCommunityMember: vi.fn(),
  updateCommunityMemberRole: vi.fn(),
  updateCommunity: vi.fn(),
  uploadCommunityAvatar: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  transferCommunityOwnership: vi.fn(),
}));

vi.mock('../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

import { CommunityManagePage } from '../../src/pages/CommunityManagePage.js';
import {
  getCommunity,
  getCommunityInvites,
  getCommunityJoinRequests,
  transferCommunityOwnership,
} from '../../src/api/communities.js';
import { useAuth } from '../../src/context/AuthContext.js';

const mockedGetCommunity = vi.mocked(getCommunity);
const mockedGetCommunityInvites = vi.mocked(getCommunityInvites);
const mockedGetCommunityJoinRequests = vi.mocked(getCommunityJoinRequests);
const mockedTransferCommunityOwnership = vi.mocked(transferCommunityOwnership);
const mockedUseAuth = vi.mocked(useAuth);

const OWNER_ID = 'owner-1';
const HEIR_ID = 'heir-2';
const COMMUNITY_ID = 'c1';

function communityFixture(myRole: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return {
    id: COMMUNITY_ID,
    name: 'Sunset Mutual Aid',
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
    myJoinRequestStatus: null,
    members: [
      {
        id: 'mem-1',
        communityId: COMMUNITY_ID,
        userId: OWNER_ID,
        role: 'OWNER',
        joinedAt: '2026-01-01',
        user: { id: OWNER_ID, name: 'Owner', avatarUrl: null },
      },
      {
        id: 'mem-2',
        communityId: COMMUNITY_ID,
        userId: HEIR_ID,
        role: 'ADMIN',
        joinedAt: '2026-01-02',
        user: { id: HEIR_ID, name: 'Alex Chen', avatarUrl: null },
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
        <MemoryRouter initialEntries={[`/communities/${COMMUNITY_ID}/manage`]}>
          <Routes>
            <Route path="/communities/:id/manage" element={<CommunityManagePage />} />
            <Route path="/communities/:id" element={<div>DETAIL</div>} />
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
  mockedGetCommunityInvites.mockResolvedValue([] as never);
  mockedGetCommunityJoinRequests.mockResolvedValue([] as never);
});

describe('CommunityManagePage — transfer ownership', () => {
  it('shows the transfer-ownership section to OWNERs', async () => {
    mockedGetCommunity.mockResolvedValueOnce(communityFixture('OWNER') as never);
    renderPage();
    await screen.findByRole('heading', { name: /transfer ownership/i });
  });

  it('hides the transfer-ownership section from ADMINs', async () => {
    mockedGetCommunity.mockResolvedValueOnce(communityFixture('ADMIN') as never);
    renderPage();
    // The members section heading is the cue that the page finished rendering.
    await screen.findByRole('heading', { name: /^members$/i });
    expect(
      screen.queryByRole('heading', { name: /transfer ownership/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the picker dialog and calls the API with the chosen heir', async () => {
    mockedGetCommunity.mockResolvedValueOnce(communityFixture('OWNER') as never);
    mockedTransferCommunityOwnership.mockResolvedValueOnce(undefined);

    const user = userEvent.setup();
    renderPage();

    const trigger = await screen.findByRole('button', { name: /transfer ownership/i });
    await user.click(trigger);

    const heir = await screen.findByRole('radio', { name: /alex chen/i });
    await user.click(heir);

    await user.click(screen.getByRole('button', { name: /make alex chen owner/i }));

    await waitFor(() =>
      expect(mockedTransferCommunityOwnership).toHaveBeenCalledWith(COMMUNITY_ID, {
        newOwnerId: HEIR_ID,
      }),
    );
  });
});
