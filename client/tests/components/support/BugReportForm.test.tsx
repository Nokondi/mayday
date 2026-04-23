import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BugReportForm } from '../../../src/components/support/BugReportForm.js';
import { submitBugReport } from '../../../src/api/bugReports.js';

vi.mock('../../../src/api/bugReports.js', () => ({
  submitBugReport: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedSubmit = vi.mocked(submitBugReport);
const mockedToast = vi.mocked(toast);

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BugReportForm />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('BugReportForm', () => {
  it('submits title and description and toasts on success', async () => {
    mockedSubmit.mockResolvedValueOnce({
      id: 'b1', title: 'T', description: 'D', status: 'OPEN',
      createdAt: '', updatedAt: '', reporter: { id: 'u1', name: 'A', email: 'a@b.com' },
    });

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/title/i), 'Login is broken');
    await user.type(
      screen.getByLabelText(/description/i),
      'Clicking log in does nothing',
    );
    await user.click(screen.getByRole('button', { name: /submit bug report/i }));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalled());
    // React Query v5 passes a second context arg to mutationFn; assert on the data arg only.
    expect(mockedSubmit.mock.calls[0][0]).toEqual({
      title: 'Login is broken',
      description: 'Clicking log in does nothing',
    });
    expect(mockedToast.success).toHaveBeenCalledWith(expect.stringMatching(/thank you/i));
  });

  it('resets the form after a successful submit so a second report can be filed', async () => {
    mockedSubmit.mockResolvedValueOnce({
      id: 'b1', title: 'T', description: 'D', status: 'OPEN',
      createdAt: '', updatedAt: '', reporter: { id: 'u1', name: 'A', email: 'a@b.com' },
    });

    const user = userEvent.setup();
    renderForm();

    const title = screen.getByLabelText(/title/i) as HTMLInputElement;
    const desc = screen.getByLabelText(/description/i) as HTMLTextAreaElement;

    await user.type(title, 'First report');
    await user.type(desc, 'Something went wrong');
    await user.click(screen.getByRole('button', { name: /submit bug report/i }));

    await waitFor(() => expect(title.value).toBe(''));
    expect(desc.value).toBe('');
  });

  it('shows validation errors when fields are empty and does not call the API', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /submit bug report/i }));

    expect(await screen.findAllByText(/required/i)).not.toHaveLength(0);
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('toasts an error message when the API rejects', async () => {
    mockedSubmit.mockRejectedValueOnce(new Error('boom'));

    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/title/i), 'Broken');
    await user.type(screen.getByLabelText(/description/i), 'Also broken');
    await user.click(screen.getByRole('button', { name: /submit bug report/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith(expect.stringMatching(/failed/i));
    });
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolve: ((value: Awaited<ReturnType<typeof submitBugReport>>) => void) = () => {};
    mockedSubmit.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));

    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/title/i), 'Title');
    await user.type(screen.getByLabelText(/description/i), 'Desc');

    const button = screen.getByRole('button', { name: /submit bug report/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent(/submitting/i);

    resolve({
      id: 'b1', title: 'T', description: 'D', status: 'OPEN',
      createdAt: '', updatedAt: '', reporter: { id: 'u1', name: 'A', email: 'a@b.com' },
    });
  });
});
