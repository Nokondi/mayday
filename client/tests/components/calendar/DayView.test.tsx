import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import type { PostWithAuthor } from '@mayday/shared';
import { describe, expect, it, vi } from 'vitest';
import { DayView } from '../../../src/components/calendar/DayView.js';
import type { Occurrence } from '../../../src/utils/recurrence.js';

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

function occ(
  id: string,
  title: string,
  startHour: number,
  type: 'REQUEST' | 'OFFER' = 'OFFER',
): Occurrence {
  const start = new Date(2026, 3, 20, startHour, 0, 0, 0);
  return {
    post: makePost({ id, title, type }),
    start,
    end: new Date(start.getTime() + 60 * 60000),
  };
}

function renderDayView(
  occurrences: Occurrence[],
  onSelectOccurrence: (occ: Occurrence) => void = vi.fn(),
) {
  render(
    <IntlProvider locale="en" defaultLocale="en">
      <DayView
        date={new Date(2026, 3, 20, 12, 0, 0)}
        occurrences={occurrences}
        onSelectOccurrence={onSelectOccurrence}
      />
    </IntlProvider>,
  );
  return { onSelectOccurrence };
}

describe('DayView', () => {
  it('renders an empty-state message when there are no occurrences', () => {
    renderDayView([]);
    expect(screen.getByText(/no events scheduled/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/hourly schedule/i),
    ).not.toBeInTheDocument();
  });

  it('renders each occurrence as a button that previews the post when clicked', async () => {
    const user = userEvent.setup();
    const event = occ('a', 'Morning Run', 9);
    const { onSelectOccurrence } = renderDayView([event]);

    const button = screen.getByRole('button', { name: /morning run/i });
    expect(within(button).getByText('9:00 AM')).toBeInTheDocument();

    await user.click(button);
    expect(onSelectOccurrence).toHaveBeenCalledWith(event);
  });

  it('shows business hours by default and a control to expand to the full day', async () => {
    const user = userEvent.setup();
    renderDayView([occ('a', 'Lunch', 12)]);

    // 7 AM is the default business-hours start; midnight is hidden until expanded.
    expect(screen.getByText('7 AM')).toBeInTheDocument();
    expect(screen.queryByText('12 AM')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show full day/i }));

    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show business hours/i }),
    ).toBeInTheDocument();
  });

  it('widens the default window to include events outside business hours', () => {
    // A 6 AM event falls before the 7 AM default start, so 6 AM must be shown.
    renderDayView([occ('a', 'Early Bird', 6)]);
    expect(screen.getByText('6 AM')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /early bird/i }),
    ).toBeInTheDocument();
  });

  it('positions consecutive hour labels at fixed pixel increments so they align with the gridlines', () => {
    // Regression: hour labels must be absolutely positioned at `index * HOUR_PX`,
    // not laid out in block flow (where a negative margin per row accumulated
    // drift and pushed labels hours away from their gridlines).
    renderDayView([occ('a', 'Lunch', 12)]);

    const sevenAm = screen.getByText('7 AM');
    const eightAm = screen.getByText('8 AM');
    const nineAm = screen.getByText('9 AM');

    // Each label carries an explicit top offset...
    expect(sevenAm.style.top).toBe('0px');
    // ...and consecutive labels differ by a constant step (no cumulative drift).
    const step =
      parseFloat(eightAm.style.top) - parseFloat(sevenAm.style.top);
    expect(step).toBeGreaterThan(0);
    expect(parseFloat(nineAm.style.top) - parseFloat(eightAm.style.top)).toBe(
      step,
    );
  });

  it('renders concurrent events side by side at half width', () => {
    renderDayView([
      occ('a', 'Meeting A', 9),
      occ('b', 'Meeting B', 9),
    ]);
    const a = screen.getByRole('button', { name: /meeting a/i });
    const b = screen.getByRole('button', { name: /meeting b/i });
    expect(a.style.width).toContain('50%');
    expect(b.style.width).toContain('50%');
    // One sits at the left edge, the other offset halfway across the lane.
    const lefts = [a.style.left, b.style.left];
    expect(lefts.some((l) => l.includes('0%'))).toBe(true);
    expect(lefts.some((l) => l.includes('50%'))).toBe(true);
  });
});
