import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportUserForm } from '../../../src/components/support/ReportUserForm.js';
import { reportUser } from '../../../src/api/users.js';

vi.mock('../../../src/api/users.js', () => ({
  reportUser: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedReport = vi.mocked(reportUser);
const mockedToast = vi.mocked(toast);

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportUserForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('ReportUserForm', () => {
  it('submits email + reason + details and toasts on success', async () => {
    mockedReport.mockResolvedValueOnce({ id: 'r1' });

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/user's email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/reason/i), 'Harassing messages');
    await user.type(screen.getByLabelText(/details/i), 'Received multiple threats');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(mockedReport).toHaveBeenCalled());
    expect(mockedReport.mock.calls[0][0]).toEqual({
      email: 'bad@example.com',
      reason: 'Harassing messages',
      details: 'Received multiple threats',
    });
    expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/submitted/i));
  });

  it('treats details as optional — submits without it', async () => {
    mockedReport.mockResolvedValueOnce({ id: 'r1' });

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/user's email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/reason/i), 'Spam');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(mockedReport).toHaveBeenCalled());
    const call = mockedReport.mock.calls[0][0];
    expect(call.email).toBe('bad@example.com');
    expect(call.reason).toBe('Spam');
    // `details` is optional so it should either be absent or empty.
    expect(call.details === undefined || call.details === '').toBe(true);
  });

  it('shows validation errors for invalid email and missing reason', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/user's email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
    expect(mockedReport).not.toHaveBeenCalled();
  });

  it('resets the form after a successful submit', async () => {
    mockedReport.mockResolvedValueOnce({ id: 'r1' });

    const user = userEvent.setup();
    renderForm();

    const email = screen.getByLabelText(/user's email/i) as HTMLInputElement;
    const reason = screen.getByLabelText(/reason/i) as HTMLInputElement;

    await user.type(email, 'bad@example.com');
    await user.type(reason, 'Spam');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() => expect(email.value).toBe(''));
    expect(reason.value).toBe('');
  });

  it('surfaces the server error message when the API rejects', async () => {
    mockedReport.mockRejectedValueOnce({
      response: { data: { error: 'No user found with that email' } },
    });

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/user's email/i), 'ghost@example.com');
    await user.type(screen.getByLabelText(/reason/i), 'Spam');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith('No user found with that email'),
    );
  });

  it('falls back to a generic error message when the server does not return one', async () => {
    mockedReport.mockRejectedValueOnce(new Error('network'));

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/user's email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/reason/i), 'Spam');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/failed to submit/i)),
    );
  });
});
