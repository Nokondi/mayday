import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PostWithAuthor } from '@mayday/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/api/posts.js', () => ({
  getPosts: vi.fn(),
}));

vi.mock('../../src/api/communities.js', () => ({
  listMyCommunities: vi.fn(),
}));

vi.mock('../../src/hooks/useDebounce.js', () => ({
  useDebounce: (value: string) => value,
}));

import { getPosts } from '../../src/api/posts.js';
import { listMyCommunities } from '../../src/api/communities.js';
import { CalendarPage } from '../../src/pages/CalendarPage.js';

const mockedGetPosts = vi.mocked(getPosts);
const mockedListMyCommunities = vi.mocked(listMyCommunities);

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'OFFER',
    status: 'OPEN',
    title: 'Event',
    description: '',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    communityId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    community: null,
    ...overrides,
  };
}

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Pin "today" to a known day inside April 2026 so the calendar grid is deterministic.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-04-15T12:00:00'));

  mockedListMyCommunities.mockResolvedValue([]);

  // jsdom doesn't implement HTMLDialogElement.showModal / .close natively.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalendarPage — overflow modal', () => {
  it('shows up to 3 events in a day cell with no overflow button when count <= 3', async () => {
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'Morning Run', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'b', title: 'Lunch with Bob', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'c', title: 'Afternoon Meeting', startAt: '2026-04-20T13:00:00' }),
      ],
      total: 3,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();

    expect(await screen.findByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Lunch with Bob')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Meeting')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more/i })).not.toBeInTheDocument();
  });

  it('renders a "+N more" button when a day has more than 3 events', async () => {
    mockedGetPosts.mockResolvedValue({
      data: [
        // Provided in non-chronological order to verify sorting.
        makePost({ id: 'c', title: 'Coffee Break', startAt: '2026-04-20T15:00:00' }),
        makePost({ id: 'a', title: 'Morning Run', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'e', title: 'Evening Yoga', startAt: '2026-04-20T17:00:00' }),
        makePost({ id: 'b', title: 'Lunch with Bob', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'd', title: 'Afternoon Meeting', startAt: '2026-04-20T13:00:00' }),
      ],
      total: 5,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();

    const overflow = await screen.findByRole('button', { name: /\+2 more/i });
    expect(overflow).toBeInTheDocument();

    // Only the first 3 chronologically should be visible in the cell.
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Lunch with Bob')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Coffee Break')).not.toBeInTheDocument();
    expect(screen.queryByText('Evening Yoga')).not.toBeInTheDocument();
  });

  it('opens a modal with all events for the day in chronological order when "+N more" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'c', title: 'Coffee Break', startAt: '2026-04-20T15:00:00' }),
        makePost({ id: 'a', title: 'Morning Run', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'e', title: 'Evening Yoga', startAt: '2026-04-20T17:00:00' }),
        makePost({ id: 'b', title: 'Lunch with Bob', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'd', title: 'Afternoon Meeting', startAt: '2026-04-20T13:00:00' }),
      ],
      total: 5,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();

    const overflow = await screen.findByRole('button', { name: /\+2 more/i });
    await user.click(overflow);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: /monday, april 20, 2026/i })).toBeInTheDocument();

    // All 5 events should be present in the dialog, sorted by start time.
    const titles = within(dialog).getAllByText(
      /morning run|lunch with bob|afternoon meeting|coffee break|evening yoga/i,
    );
    expect(titles.map((el) => el.textContent)).toEqual([
      'Morning Run',
      'Lunch with Bob',
      'Afternoon Meeting',
      'Coffee Break',
      'Evening Yoga',
    ]);
  });

  it('renders each event in the modal as a link to the post detail page', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'Morning Run', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'b', title: 'Lunch with Bob', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'c', title: 'Afternoon Meeting', startAt: '2026-04-20T13:00:00' }),
        makePost({ id: 'd', title: 'Coffee Break', startAt: '2026-04-20T15:00:00' }),
      ],
      total: 4,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();

    await user.click(await screen.findByRole('button', { name: /\+1 more/i }));

    const dialog = await screen.findByRole('dialog');
    const link = within(dialog).getByRole('link', { name: /coffee break/i });
    expect(link).toHaveAttribute('href', '/posts/d');
  });

  it('makes the modal body scrollable so long event lists do not overflow the viewport', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'A', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'b', title: 'B', startAt: '2026-04-20T10:00:00' }),
        makePost({ id: 'c', title: 'C', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'd', title: 'D', startAt: '2026-04-20T12:00:00' }),
      ],
      total: 4,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await user.click(await screen.findByRole('button', { name: /\+1 more/i }));

    const dialog = await screen.findByRole('dialog');
    // The container that holds the event list has overflow-y-auto and a height cap.
    const scrollable = dialog.querySelector('.overflow-y-auto');
    expect(scrollable).not.toBeNull();
    expect(dialog.querySelector('.max-h-\\[80vh\\]')).not.toBeNull();
  });

  it('closes the modal when the close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'A', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'b', title: 'B', startAt: '2026-04-20T10:00:00' }),
        makePost({ id: 'c', title: 'C', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'd', title: 'D', startAt: '2026-04-20T12:00:00' }),
      ],
      total: 4,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await user.click(await screen.findByRole('button', { name: /\+1 more/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('open');

    await user.click(within(dialog).getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(dialog).not.toHaveAttribute('open');
    });
  });

  it('closes the modal when an event link inside it is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'A', startAt: '2026-04-20T09:00:00' }),
        makePost({ id: 'b', title: 'B', startAt: '2026-04-20T10:00:00' }),
        makePost({ id: 'c', title: 'C', startAt: '2026-04-20T11:00:00' }),
        makePost({ id: 'd', title: 'D', startAt: '2026-04-20T12:00:00' }),
      ],
      total: 4,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await user.click(await screen.findByRole('button', { name: /\+1 more/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('link', { name: /D/ }));

    await waitFor(() => {
      expect(dialog).not.toHaveAttribute('open');
    });
  });
});
