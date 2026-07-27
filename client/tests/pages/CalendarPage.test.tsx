import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { IntlProvider } from 'react-intl';
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
    sharedWithFriends: false,
    title: 'Event',
    description: '',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    commentCount: 0,
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      links: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    communities: [],
    ...overrides,
  };
}

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </QueryClientProvider>
    </IntlProvider>,
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

describe('CalendarPage — month grid', () => {
  it('shows up to 3 events in a day cell with no overflow indicator when count <= 3', async () => {
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
    expect(screen.queryByText(/\+\d+ more/i)).not.toBeInTheDocument();
  });

  it('shows only the first 3 events plus a non-interactive "+N more" indicator when a day has more than 3', async () => {
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

    // The overflow hint is now plain text (the dialog was removed) — clicking
    // anywhere in the cell, including here, goes to the day view instead.
    expect(await screen.findByText(/\+2 more/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /\+2 more/i }),
    ).not.toBeInTheDocument();

    // Only the first 3 chronologically should be visible in the cell.
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Lunch with Bob')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Coffee Break')).not.toBeInTheDocument();
    expect(screen.queryByText('Evening Yoga')).not.toBeInTheDocument();
  });

  it('opens a post preview dialog (instead of navigating) when an event chip is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'Workshop', startAt: '2026-04-20T14:00:00' }),
      ],
      total: 1,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();

    // Chips are buttons now, not links.
    await user.click(await screen.findByRole('button', { name: /workshop/i }));

    const dialog = await screen.findByRole('dialog');
    // The embedded PostCard still links to the full post for those who want it.
    expect(within(dialog).getByRole('link')).toHaveAttribute('href', '/posts/a');

    // The calendar stayed put — the chip won over the cell's day-view navigation,
    // so we're still on the month grid (not the hourly day view).
    expect(
      screen.getByRole('heading', { name: /april 2026/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/hourly schedule/i)).not.toBeInTheDocument();
  });

  it('closes the preview dialog when its close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'Workshop', startAt: '2026-04-20T14:00:00' }),
      ],
      total: 1,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await user.click(await screen.findByRole('button', { name: /workshop/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('open');

    await user.click(within(dialog).getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(dialog).not.toHaveAttribute('open');
    });
  });

  it('navigates to the day view when an empty area of the day cell is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [
        makePost({ id: 'a', title: 'Workshop', startAt: '2026-04-20T14:00:00' }),
      ],
      total: 1,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await screen.findByText('Workshop');

    // The whole-cell click target is a button labelled with the date.
    await user.click(
      screen.getByRole('button', { name: /view monday, april 20, 2026/i }),
    );

    expect(
      screen.getByRole('heading', { name: /monday, april 20, 2026/i }),
    ).toBeInTheDocument();
    // The event shows in the day view as a button (clicking opens the preview).
    expect(
      screen.getByRole('button', { name: /workshop/i }),
    ).toBeInTheDocument();
  });

});

describe('CalendarPage — collapsible search & filters', () => {
  it('hides the search bar and filters by default', async () => {
    mockedGetPosts.mockResolvedValue({ data: [], total: 0, limit: 200, page: 1, totalPages: 1 });
    renderCalendar();
    await waitFor(() => expect(mockedGetPosts).toHaveBeenCalled());

    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /filter by type/i }),
    ).not.toBeInTheDocument();
  });

  it('reveals the search bar and filters when the toggle is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({ data: [], total: 0, limit: 200, page: 1, totalPages: 1 });
    renderCalendar();

    await user.click(screen.getByRole('button', { name: /search & filters/i }));

    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: /filter by type/i }),
    ).toBeInTheDocument();
  });

  it('shows a dismissable chip for an active filter and clears it when dismissed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({ data: [], total: 0, limit: 200, page: 1, totalPages: 1 });
    renderCalendar();

    await user.click(screen.getByRole('button', { name: /search & filters/i }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: /filter by type/i }),
      'REQUEST',
    );

    // The chip's remove button is unique (the filter dropdown also has a
    // "Requests" option), so scope the assertion to it.
    const remove = await screen.findByRole('button', { name: /remove requests/i });
    await user.click(remove);

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /remove requests/i }),
      ).not.toBeInTheDocument(),
    );
    // Clearing the filter refetches without the type constraint.
    await waitFor(() =>
      expect(mockedGetPosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: undefined }),
      ),
    );
  });
});

describe('CalendarPage — day view', () => {
  it('switches to an hourly day view for the current day via the Day toggle', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [makePost({ id: 'a', title: 'Standup', startAt: '2026-04-15T09:00:00' })],
      total: 1,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await screen.findByText('Standup');

    await user.click(screen.getByRole('button', { name: /^day$/i }));

    expect(screen.getByLabelText(/hourly schedule/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /wednesday, april 15, 2026/i }),
    ).toBeInTheDocument();
    // Day-view events are buttons that open the preview dialog (same as month view).
    expect(
      screen.getByRole('button', { name: /standup/i }),
    ).toBeInTheDocument();
  });

  it('navigates one day at a time with the previous/next controls in day view', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockedGetPosts.mockResolvedValue({
      data: [],
      total: 0,
      limit: 200,
      page: 1,
      totalPages: 1,
    });

    renderCalendar();
    await user.click(screen.getByRole('button', { name: /^day$/i }));
    await screen.findByText(/no events scheduled/i);

    expect(
      screen.getByRole('heading', { name: /wednesday, april 15, 2026/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next day/i }));
    expect(
      screen.getByRole('heading', { name: /thursday, april 16, 2026/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous day/i }));
    await user.click(screen.getByRole('button', { name: /previous day/i }));
    expect(
      screen.getByRole('heading', { name: /tuesday, april 14, 2026/i }),
    ).toBeInTheDocument();
  });
});
