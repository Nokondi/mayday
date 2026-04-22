import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/context/AuthContext.js';
import * as authApi from '../../src/api/auth.js';
import * as client from '../../src/api/client.js';

vi.mock('../../src/api/auth.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('../../src/api/client.js', () => {
  let token: string | null = null;
  return {
    setAccessToken: vi.fn((t: string | null) => { token = t; }),
    getAccessToken: vi.fn(() => token),
  };
});

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}));

const mockedAxios = vi.mocked(axios as unknown as { post: ReturnType<typeof vi.fn> });
const mockedAuthApi = vi.mocked(authApi);
const mockedClient = vi.mocked(client);

function TestHarness() {
  const { user, isLoading, login, register, logout, refreshUser } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'done'}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <button onClick={() => login({ email: 'a@b.com', password: 'pw' })}>login</button>
      <button onClick={() => register({ email: 'a@b.com', password: 'pw', name: 'A' })}>register</button>
      <button onClick={() => logout()}>logout</button>
      <button onClick={() => refreshUser()}>refresh</button>
    </div>
  );
}

function renderWithAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedClient.setAccessToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthProvider init', () => {
  it('attempts a refresh when there is no access token, then loads the user', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: 'new-access' } });
    mockedAuthApi.getMe.mockResolvedValueOnce({
      id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'USER', avatarUrl: null,
    });

    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'));
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, { withCredentials: true });
    expect(mockedClient.setAccessToken).toHaveBeenCalledWith('new-access');
    expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com');
  });

  it('sets user=null when the refresh call fails (not logged in)', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('no refresh cookie'));

    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(mockedAuthApi.getMe).not.toHaveBeenCalled();
  });

  it('falls back to user=null when refresh succeeds but getMe fails', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: 'new-access' } });
    mockedAuthApi.getMe.mockRejectedValueOnce(new Error('bad token'));

    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(mockedClient.setAccessToken).toHaveBeenLastCalledWith(null);
  });
});

describe('AuthProvider actions', () => {
  it('login sets the access token and user', async () => {
    // Init: no session
    mockedAxios.post.mockRejectedValueOnce(new Error('no session'));
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'));

    mockedAuthApi.login.mockResolvedValueOnce({
      accessToken: 'fresh-token',
      user: { id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'USER', avatarUrl: null },
    });

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com'));
    expect(mockedClient.setAccessToken).toHaveBeenCalledWith('fresh-token');
  });

  it('register returns a message and does NOT log the user in', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('no session'));
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('done'));

    mockedAuthApi.register.mockResolvedValueOnce({
      message: 'Check your email',
      user: { id: 'u1', email: 'alice@example.com', name: 'Alice' },
    });

    await userEvent.click(screen.getByText('register'));

    // User is still logged out after register.
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(mockedClient.setAccessToken).not.toHaveBeenCalledWith(expect.stringMatching(/.+/));
  });

  it('logout calls the API and clears session state', async () => {
    // Start logged in.
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: 'tok' } });
    mockedAuthApi.getMe.mockResolvedValueOnce({
      id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'USER', avatarUrl: null,
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com'));

    mockedAuthApi.logout.mockResolvedValueOnce();
    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(mockedAuthApi.logout).toHaveBeenCalled();
    expect(mockedClient.setAccessToken).toHaveBeenLastCalledWith(null);
  });

  it('refreshUser re-fetches the current user', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: 'tok' } });
    mockedAuthApi.getMe.mockResolvedValueOnce({
      id: 'u1', email: 'old@example.com', name: 'Old', role: 'USER', avatarUrl: null,
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('old@example.com'));

    mockedAuthApi.getMe.mockResolvedValueOnce({
      id: 'u1', email: 'new@example.com', name: 'New', role: 'USER', avatarUrl: null,
    });

    await act(async () => {
      await userEvent.click(screen.getByText('refresh'));
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('new@example.com'));
  });

  it('refreshUser silently ignores errors (keeps existing user state)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { accessToken: 'tok' } });
    mockedAuthApi.getMe.mockResolvedValueOnce({
      id: 'u1', email: 'alice@example.com', name: 'Alice', role: 'USER', avatarUrl: null,
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com'));

    mockedAuthApi.getMe.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await userEvent.click(screen.getByText('refresh'));
    });

    // Still logged in with previous user.
    expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com');
  });
});

describe('useAuth outside a provider', () => {
  it('throws a helpful error', () => {
    // Silence the expected error
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useAuth();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/within AuthProvider/);
    err.mockRestore();
  });
});
