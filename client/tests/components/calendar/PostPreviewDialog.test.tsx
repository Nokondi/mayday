import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import type { PostWithAuthor } from '@mayday/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostPreviewDialog } from '../../../src/components/calendar/PostPreviewDialog.js';
import type { Occurrence } from '../../../src/utils/recurrence.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'a',
    type: 'OFFER',
    status: 'OPEN',
    sharedWithFriends: false,
    title: 'Workshop',
    description: 'Bring your own tools',
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

function makeOccurrence(overrides: Partial<PostWithAuthor> = {}): Occurrence {
  const start = new Date(2026, 3, 20, 14, 0, 0);
  return {
    post: makePost(overrides),
    start,
    end: new Date(start.getTime() + 60 * 60000),
  };
}

function renderDialog(
  occurrence: Occurrence | null,
  onClose: () => void = vi.fn(),
) {
  render(
    <IntlProvider locale="en" defaultLocale="en">
      <MemoryRouter>
        <PostPreviewDialog occurrence={occurrence} onClose={onClose} />
      </MemoryRouter>
    </IntlProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-04-15T12:00:00'));

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

describe('PostPreviewDialog', () => {
  it('renders no post content while closed (occurrence is null)', () => {
    renderDialog(null);
    expect(screen.queryByText('Workshop')).not.toBeInTheDocument();
  });

  it('opens with the occurrence date heading and the post details', () => {
    renderDialog(makeOccurrence());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    expect(
      within(dialog).getByRole('heading', { name: /monday, april 20, 2026/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Workshop')).toBeInTheDocument();
    // The embedded PostCard still links to the full post detail page.
    expect(within(dialog).getByRole('link')).toHaveAttribute('href', '/posts/a');
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onClose } = renderDialog(makeOccurrence());

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
