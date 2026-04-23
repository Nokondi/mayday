import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/auth.js', () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from '../../src/api/auth.js';
import { ForgotPasswordPage } from '../../src/pages/ForgotPasswordPage.js';

const mockedForgotPassword = vi.mocked(forgotPassword);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ForgotPasswordPage', () => {
  it('POSTs the email and shows a generic confirmation on success', async () => {
    mockedForgotPassword.mockResolvedValueOnce({ message: 'If that account exists...' });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(mockedForgotPassword).toHaveBeenCalled());
    // React Query v5 passes a context arg; assert on the data arg only.
    expect(mockedForgotPassword.mock.calls[0][0]).toEqual({ email: 'alice@example.com' });
    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
  });

  it('shows validation error for invalid email and does not call the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(mockedForgotPassword).not.toHaveBeenCalled();
  });

  it('shows the same generic confirmation even if the email is unknown (no enumeration on the UI)', async () => {
    mockedForgotPassword.mockResolvedValueOnce({ message: 'If that account exists...' });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'ghost@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
  });
});
