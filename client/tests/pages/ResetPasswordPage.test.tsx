import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/auth.js', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '../../src/api/auth.js';
import { ResetPasswordPage } from '../../src/pages/ResetPasswordPage.js';

const mockedResetPassword = vi.mocked(resetPassword);

function renderPage(path = '/reset-password?token=tok123') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ResetPasswordPage', () => {
  it('shows an error state when the URL has no token', async () => {
    renderPage('/reset-password');
    expect(screen.getByText(/missing reset token/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new one/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('submits the new password with the token from the URL', async () => {
    mockedResetPassword.mockResolvedValueOnce({ message: 'Password updated.' });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-pw');
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(mockedResetPassword).toHaveBeenCalledWith({
      token: 'tok123',
      password: 'brand-new-pw',
    }));
    expect(await screen.findByRole('heading', { name: /password updated/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('requires password and confirmation to match', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-pw');
    await user.type(screen.getByLabelText(/confirm new password/i), 'different-pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('surfaces the server error when the token is expired', async () => {
    mockedResetPassword.mockRejectedValueOnce({
      response: { data: { error: 'Invalid or expired reset link' } },
    });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^new password$/i), 'brand-new-pw');
    await user.type(screen.getByLabelText(/confirm new password/i), 'brand-new-pw');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/invalid or expired reset link/i)).toBeInTheDocument();
    // And no "Password updated" success screen.
    expect(screen.queryByRole('heading', { name: /password updated/i })).not.toBeInTheDocument();
  });
});
