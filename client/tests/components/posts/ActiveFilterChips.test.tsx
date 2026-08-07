import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveFilterChips } from '../../../src/components/posts/ActiveFilterChips.js';

const noop = () => {};

function renderChips(props: Partial<Parameters<typeof ActiveFilterChips>[0]> = {}) {
  const onClear = vi.fn();
  render(
    <IntlProvider locale="en" defaultLocale="en">
      <ActiveFilterChips
        type=""
        category=""
        urgency=""
        sort="recent"
        community=""
        q=""
        communities={[{ id: 'c1', name: 'East Side Mutual Aid' }]}
        onClear={onClear}
        {...props}
      />
    </IntlProvider>,
  );
  return { onClear };
}

beforeEach(() => vi.clearAllMocks());

describe('ActiveFilterChips', () => {
  it('renders nothing when no filters are active and sort is default', () => {
    const { container } = render(
      <IntlProvider locale="en" defaultLocale="en">
        <ActiveFilterChips
          type=""
          category=""
          urgency=""
          sort="recent"
          community=""
          q=""
          onClear={noop}
        />
      </IntlProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a chip for each active filter with a localized label', () => {
    renderChips({
      type: 'REQUEST',
      category: 'Food',
      urgency: 'HIGH',
      community: 'c1',
      q: 'tents',
      sort: 'urgency',
    });
    expect(screen.getByText('Search: tents')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('East Side Mutual Aid')).toBeInTheDocument();
    expect(screen.getByText('Most Urgent')).toBeInTheDocument();
  });

  it('renders a "Friends" chip when the audience filter is set to friends', () => {
    renderChips({ community: 'friends' });
    expect(screen.getByText('Friends')).toBeInTheDocument();
  });

  it('renders an "Events" chip when the type filter is EVENT', () => {
    renderChips({ type: 'EVENT' });
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders a "Comms" chip when the type filter is COMMS', () => {
    renderChips({ type: 'COMMS' });
    expect(screen.getByText('Comms')).toBeInTheDocument();
  });

  it('does not render a sort chip when sort is the default chronological order', () => {
    renderChips({ type: 'OFFER', sort: 'recent' });
    expect(screen.getByText('Offers')).toBeInTheDocument();
    expect(screen.queryByText('Most Urgent')).not.toBeInTheDocument();
  });

  it('calls onClear with the filter key when a chip is dismissed', async () => {
    const user = userEvent.setup();
    const { onClear } = renderChips({ urgency: 'LOW' });
    await user.click(screen.getByRole('button', { name: /remove low/i }));
    expect(onClear).toHaveBeenCalledWith('urgency');
  });
});
