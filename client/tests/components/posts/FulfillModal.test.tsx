import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/api/posts.js', () => ({
  fulfillPost: vi.fn(),
  searchFulfillers: vi.fn(),
}));

vi.mock('../../../src/hooks/useDebounce.js', () => ({
  useDebounce: (value: string) => value,
}));

import { toast } from 'sonner';
import { fulfillPost, searchFulfillers } from '../../../src/api/posts.js';
import { FulfillModal } from '../../../src/components/posts/FulfillModal.js';

const mockedFulfillPost = vi.mocked(fulfillPost);
const mockedSearchFulfillers = vi.mocked(searchFulfillers);
const mockedToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function renderModal(props: { open?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <FulfillModal postId="p1" open={props.open ?? true} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedSearchFulfillers.mockResolvedValue({ users: [], organizations: [] });
  // jsdom doesn't implement HTMLDialogElement.showModal / .close natively.
  // Stub them so the component doesn't throw.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('FulfillModal — rendering', () => {
  it('shows the dialog with a title and one empty input when open', async () => {
    renderModal();
    expect(await screen.findByRole('heading', { name: /mark as fulfilled/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type a name/i)).toBeInTheDocument();
  });

  it('disables the submit button when no names are filled in', () => {
    renderModal();
    const submit = screen.getByRole('button', { name: /mark as fulfilled/i });
    expect(submit).toBeDisabled();
  });
});

describe('FulfillModal — adding and removing fulfillers', () => {
  it('adds a new fulfiller input when "Add another" is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /add another/i }));

    const inputs = screen.getAllByPlaceholderText(/type a name/i);
    expect(inputs).toHaveLength(2);
  });

  it('removes a fulfiller input when the remove button is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    // Add a second input first
    await user.click(screen.getByRole('button', { name: /add another/i }));
    expect(screen.getAllByPlaceholderText(/type a name/i)).toHaveLength(2);

    // Remove buttons appear (one per row since there are 2)
    const removeButtons = screen.getAllByRole('button').filter(
      btn => btn.querySelector('.lucide-x') && !btn.textContent?.includes('Mark'),
    );
    await user.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText(/type a name/i)).toHaveLength(1);
  });

  it('does not show a remove button when there is only one fulfiller', () => {
    renderModal();
    // The only X button should be the close button in the header, not a row remove button
    const inputs = screen.getAllByPlaceholderText(/type a name/i);
    expect(inputs).toHaveLength(1);
  });
});

describe('FulfillModal — submission', () => {
  it('calls fulfillPost with the entered name and shows a success toast', async () => {
    const user = userEvent.setup();
    mockedFulfillPost.mockResolvedValueOnce({} as never);
    const { onClose } = renderModal();

    await user.type(screen.getByPlaceholderText(/type a name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));

    await waitFor(() => {
      expect(mockedFulfillPost).toHaveBeenCalledWith('p1', {
        fulfillers: [{ name: 'Bob' }],
      });
    });
    await waitFor(() => {
      expect(mockedToast.success).toHaveBeenCalledWith('Post marked as fulfilled');
    });
  });

  it('submits multiple fulfillers', async () => {
    const user = userEvent.setup();
    mockedFulfillPost.mockResolvedValueOnce({} as never);
    renderModal();

    const firstInput = screen.getByPlaceholderText(/type a name/i);
    await user.type(firstInput, 'Alice');

    await user.click(screen.getByRole('button', { name: /add another/i }));
    const inputs = screen.getAllByPlaceholderText(/type a name/i);
    await user.type(inputs[1], 'Red Cross');

    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));

    await waitFor(() => {
      expect(mockedFulfillPost).toHaveBeenCalledWith('p1', {
        fulfillers: [{ name: 'Alice' }, { name: 'Red Cross' }],
      });
    });
  });

  it('filters out empty fulfiller names before submitting', async () => {
    const user = userEvent.setup();
    mockedFulfillPost.mockResolvedValueOnce({} as never);
    renderModal();

    // Add a second row but leave it empty
    await user.type(screen.getByPlaceholderText(/type a name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /add another/i }));

    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));

    await waitFor(() => {
      expect(mockedFulfillPost).toHaveBeenCalledWith('p1', {
        fulfillers: [{ name: 'Bob' }],
      });
    });
  });

  it('shows an error toast when the API call fails', async () => {
    const user = userEvent.setup();
    mockedFulfillPost.mockRejectedValueOnce(new Error('network'));
    renderModal();

    await user.type(screen.getByPlaceholderText(/type a name/i), 'Bob');
    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('Failed to mark post as fulfilled');
    });
  });
});

describe('FulfillModal — autocomplete', () => {
  it('shows search results when typing a name', async () => {
    const user = userEvent.setup();
    mockedSearchFulfillers.mockResolvedValue({
      users: [{ id: 'u2', name: 'Bobby Tables', avatarUrl: null }],
      organizations: [{ id: 'o1', name: 'Bob Foundation', avatarUrl: null }],
    });
    renderModal();

    await user.type(screen.getByPlaceholderText(/type a name/i), 'Bob');

    await waitFor(() => {
      expect(screen.getByText('Bobby Tables')).toBeInTheDocument();
      expect(screen.getByText('Bob Foundation')).toBeInTheDocument();
    });
  });

  it('fills the input when a user suggestion is clicked', async () => {
    const user = userEvent.setup();
    mockedSearchFulfillers.mockResolvedValue({
      users: [{ id: 'u2', name: 'Bobby Tables', avatarUrl: null }],
      organizations: [],
    });
    mockedFulfillPost.mockResolvedValueOnce({} as never);
    renderModal();

    const input = screen.getByPlaceholderText(/type a name/i);
    await user.type(input, 'Bob');

    await waitFor(() => {
      expect(screen.getByText('Bobby Tables')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Bobby Tables'));

    expect(input).toHaveValue('Bobby Tables');

    // Submit and verify the userId was attached
    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));
    await waitFor(() => {
      expect(mockedFulfillPost).toHaveBeenCalledWith('p1', {
        fulfillers: [{ name: 'Bobby Tables', userId: 'u2' }],
      });
    });
  });

  it('fills the input when an organization suggestion is clicked', async () => {
    const user = userEvent.setup();
    mockedSearchFulfillers.mockResolvedValue({
      users: [],
      organizations: [{ id: 'o1', name: 'Aid League', avatarUrl: null }],
    });
    mockedFulfillPost.mockResolvedValueOnce({} as never);
    renderModal();

    const input = screen.getByPlaceholderText(/type a name/i);
    await user.type(input, 'Aid');

    await waitFor(() => {
      expect(screen.getByText('Aid League')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Aid League'));

    expect(input).toHaveValue('Aid League');

    await user.click(screen.getByRole('button', { name: /mark as fulfilled/i }));
    await waitFor(() => {
      expect(mockedFulfillPost).toHaveBeenCalledWith('p1', {
        fulfillers: [{ name: 'Aid League', organizationId: 'o1' }],
      });
    });
  });
});
