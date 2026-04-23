import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/context/AuthContext.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../src/api/users.js', () => ({
  getUser: vi.fn(),
  getUserPosts: vi.fn(),
  updateProfile: vi.fn(),
  uploadUserAvatar: vi.fn(),
}));

vi.mock('../../src/api/messages.js', () => ({
  startConversation: vi.fn(),
}));

import { useAuth } from '../../src/context/AuthContext.js';
import { getUser, getUserPosts } from '../../src/api/users.js';
import { startConversation } from '../../src/api/messages.js';
import { toast } from 'sonner';
import { ProfilePage } from '../../src/pages/ProfilePage.js';

const mockedUseAuth = vi.mocked(useAuth);
const mockedGetUser = vi.mocked(getUser);
const mockedGetUserPosts = vi.mocked(getUserPosts);
const mockedStartConversation = vi.mocked(startConversation);
const mockedToast = vi.mocked(toast);

const VIEWER_ID = 'viewer-1';
const OWNER_ID = 'owner-2';

function setAuth(id: string | null) {
  mockedUseAuth.mockReturnValue({
    user: id ? { id, email: 'viewer@example.com', name: 'Viewer', role: 'USER', avatarUrl: null } : null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  } as ReturnType<typeof useAuth>);
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: OWNER_ID,
    name: 'Peter Kropotkin',
    bio: null,
    location: null,
    latitude: null,
    longitude: null,
    skills: [],
    avatarUrl: null,
    createdAt: new Date('2026-01-01').toISOString(),
    ...overrides,
  };
}

// Probe that exposes the current location.pathname + search for navigation assertions.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderProfile(path = `/profile/${OWNER_ID}`) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile/:id" element={<><ProfilePage /><LocationProbe /></>} />
          <Route path="/messages" element={<><div>MESSAGES PAGE</div><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetUser.mockResolvedValue(profile() as never);
  mockedGetUserPosts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 } as never);
});

describe('ProfilePage message button', () => {
  it('does not show a Message button on your own profile', async () => {
    setAuth(OWNER_ID);
    renderProfile();

    await screen.findByRole('heading', { level: 1, name: /Peter Kropotkin/i });
    expect(screen.queryByRole('button', { name: /message/i })).not.toBeInTheDocument();
    // The Edit button is what an owner sees instead.
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows a Message button when viewing another user\'s profile', async () => {
    setAuth(VIEWER_ID);
    renderProfile();

    expect(await screen.findByRole('button', { name: /message/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('starts a conversation and navigates to /messages?conversation=<id> when clicked', async () => {
    setAuth(VIEWER_ID);
    mockedStartConversation.mockResolvedValueOnce({
      id: 'conv-99',
      participantAId: VIEWER_ID,
      participantBId: OWNER_ID,
      createdAt: new Date('2026-04-22').toISOString(),
      updatedAt: new Date('2026-04-22').toISOString(),
    } as never);

    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('button', { name: /message/i }));

    await waitFor(() => expect(mockedStartConversation).toHaveBeenCalled());
    expect(mockedStartConversation.mock.calls[0][0]).toEqual({ participantId: OWNER_ID });

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/messages?conversation=conv-99'),
    );
  });

  it('shows an error toast and stays on the profile if starting the conversation fails', async () => {
    setAuth(VIEWER_ID);
    mockedStartConversation.mockRejectedValueOnce(new Error('network'));

    const user = userEvent.setup();
    renderProfile();

    await user.click(await screen.findByRole('button', { name: /message/i }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/could not start/i)),
    );
    // Still on the profile route.
    expect(screen.getByTestId('location')).toHaveTextContent(`/profile/${OWNER_ID}`);
  });

  it('disables the Message button while the request is in flight', async () => {
    setAuth(VIEWER_ID);
    let resolve: ((value: Awaited<ReturnType<typeof startConversation>>) => void) = () => {};
    mockedStartConversation.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));

    const user = userEvent.setup();
    renderProfile();

    const button = await screen.findByRole('button', { name: /message/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent(/starting/i);

    resolve({
      id: 'conv-1',
      participantAId: VIEWER_ID,
      participantBId: OWNER_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
  });
});
