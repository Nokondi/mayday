import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATEGORIES } from '@mayday/shared';
import { PostFilters } from '../../../src/components/posts/PostFilters.js';

type Handler = ReturnType<typeof vi.fn<(v: string) => void>>;
type Handlers = {
  onTypeChange: Handler;
  onCategoryChange: Handler;
  onUrgencyChange: Handler;
  onSortChange: Handler;
};

function renderFilters(
  values: { type?: string; category?: string; urgency?: string; sort?: string } = {},
): Handlers {
  const handlers: Handlers = {
    onTypeChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onUrgencyChange: vi.fn(),
    onSortChange: vi.fn(),
  };
  render(
    <PostFilters
      type={values.type ?? ''}
      category={values.category ?? ''}
      urgency={values.urgency ?? ''}
      sort={values.sort ?? 'recent'}
      {...handlers}
    />,
  );
  return handlers;
}

function selectByDefaultOption(defaultOptionLabel: string): HTMLSelectElement {
  // Find the <select> whose default (empty-value or sort) option contains the label.
  const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
  for (const sel of selects) {
    const hasOption = within(sel).queryByRole('option', { name: defaultOptionLabel });
    if (hasOption) return sel;
  }
  throw new Error(`No select contains an option "${defaultOptionLabel}"`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PostFilters — rendering', () => {
  it('renders four select controls', () => {
    renderFilters();
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
  });

  it('renders the type options (All / Requests / Offers)', () => {
    renderFilters();
    const typeSelect = selectByDefaultOption('All Types');
    expect(within(typeSelect).getByRole('option', { name: 'All Types' })).toHaveValue('');
    expect(within(typeSelect).getByRole('option', { name: 'Requests' })).toHaveValue('REQUEST');
    expect(within(typeSelect).getByRole('option', { name: 'Offers' })).toHaveValue('OFFER');
  });

  it('renders every shared CATEGORIES entry in the category select', () => {
    renderFilters();
    const categorySelect = selectByDefaultOption('All Categories');
    expect(within(categorySelect).getByRole('option', { name: 'All Categories' })).toHaveValue('');
    for (const cat of CATEGORIES) {
      expect(within(categorySelect).getByRole('option', { name: cat })).toHaveValue(cat);
    }
  });

  it('renders the urgency options', () => {
    renderFilters();
    const urgencySelect = selectByDefaultOption('All Urgency');
    for (const [label, value] of [
      ['All Urgency', ''],
      ['Low', 'LOW'],
      ['Medium', 'MEDIUM'],
      ['High', 'HIGH'],
      ['Critical', 'CRITICAL'],
    ] as const) {
      expect(within(urgencySelect).getByRole('option', { name: label })).toHaveValue(value);
    }
  });

  it('renders the sort options (Most Recent / Most Urgent)', () => {
    renderFilters();
    const sortSelect = selectByDefaultOption('Most Recent');
    expect(within(sortSelect).getByRole('option', { name: 'Most Recent' })).toHaveValue('recent');
    expect(within(sortSelect).getByRole('option', { name: 'Most Urgent' })).toHaveValue('urgency');
  });
});

describe('PostFilters — controlled values', () => {
  it('reflects the provided type value', () => {
    renderFilters({ type: 'OFFER' });
    expect(selectByDefaultOption('All Types')).toHaveValue('OFFER');
  });

  it('reflects the provided category value', () => {
    renderFilters({ category: 'Housing' });
    expect(selectByDefaultOption('All Categories')).toHaveValue('Housing');
  });

  it('reflects the provided urgency value', () => {
    renderFilters({ urgency: 'CRITICAL' });
    expect(selectByDefaultOption('All Urgency')).toHaveValue('CRITICAL');
  });

  it('reflects the provided sort value', () => {
    renderFilters({ sort: 'urgency' });
    expect(selectByDefaultOption('Most Recent')).toHaveValue('urgency');
  });
});

describe('PostFilters — change handlers', () => {
  it('calls onTypeChange with the selected type value', async () => {
    const user = userEvent.setup();
    const handlers = renderFilters();
    await user.selectOptions(selectByDefaultOption('All Types'), 'OFFER');
    expect(handlers.onTypeChange).toHaveBeenCalledWith('OFFER');
  });

  it('calls onCategoryChange with the selected category value', async () => {
    const user = userEvent.setup();
    const handlers = renderFilters();
    await user.selectOptions(selectByDefaultOption('All Categories'), 'Food');
    expect(handlers.onCategoryChange).toHaveBeenCalledWith('Food');
  });

  it('calls onUrgencyChange with the selected urgency value', async () => {
    const user = userEvent.setup();
    const handlers = renderFilters();
    await user.selectOptions(selectByDefaultOption('All Urgency'), 'HIGH');
    expect(handlers.onUrgencyChange).toHaveBeenCalledWith('HIGH');
  });

  it('calls onSortChange with the selected sort value', async () => {
    const user = userEvent.setup();
    const handlers = renderFilters();
    await user.selectOptions(selectByDefaultOption('Most Recent'), 'urgency');
    expect(handlers.onSortChange).toHaveBeenCalledWith('urgency');
  });

  it('calls onTypeChange with "" when the user clears the type back to All Types', async () => {
    const user = userEvent.setup();
    const handlers = renderFilters({ type: 'REQUEST' });
    await user.selectOptions(selectByDefaultOption('All Types'), '');
    expect(handlers.onTypeChange).toHaveBeenCalledWith('');
  });
});
