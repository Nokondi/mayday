import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EntityCard } from '../../../src/components/common/EntityCard.js';

function renderCard(overrides: Partial<Parameters<typeof EntityCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <EntityCard
        to="/organizations/o1"
        name="Acme Co"
        memberCount={1}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe('EntityCard — required fields', () => {
  it('renders the name as a heading inside a link to the supplied target', () => {
    renderCard({ to: '/communities/c1', name: 'Eastside Neighbors' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/communities/c1');
    expect(
      screen.getByRole('heading', { name: 'Eastside Neighbors' }),
    ).toBeInTheDocument();
  });

  it('renders "1 member" (singular) when memberCount is 1', () => {
    renderCard({ memberCount: 1 });
    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('renders "N members" (plural) for any non-1 count, including 0', () => {
    renderCard({ memberCount: 0 });
    expect(screen.getByText('0 members')).toBeInTheDocument();
  });

  it('renders the plural form for counts > 1', () => {
    renderCard({ memberCount: 42 });
    expect(screen.getByText('42 members')).toBeInTheDocument();
  });
});

describe('EntityCard — optional fields', () => {
  it('omits the avatar img when avatarUrl is null/undefined', () => {
    const { container } = renderCard({ avatarUrl: null });
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the avatar img when avatarUrl is provided', () => {
    const { container } = renderCard({ avatarUrl: 'https://cdn.example.com/a.png' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/a.png');
  });

  it('omits the description paragraph when none is supplied', () => {
    renderCard({ description: null });
    // The only paragraph would be a description; assert no <p> sibling text.
    expect(screen.queryByText(/local community/i)).not.toBeInTheDocument();
  });

  it('renders the description when supplied', () => {
    renderCard({ description: 'A neighborhood mutual-aid group' });
    expect(
      screen.getByText('A neighborhood mutual-aid group'),
    ).toBeInTheDocument();
  });

  it('omits location when none is supplied', () => {
    renderCard({ location: null });
    expect(screen.queryByText(/seattle/i)).not.toBeInTheDocument();
  });

  it('renders location when supplied', () => {
    renderCard({ location: 'Seattle, WA' });
    expect(screen.getByText('Seattle, WA')).toBeInTheDocument();
  });

  it('omits the role indicator when myRole is null', () => {
    renderCard({ myRole: null });
    expect(screen.queryByText(/^you:/i)).not.toBeInTheDocument();
  });

  it('renders the role indicator in lowercase when myRole is provided', () => {
    renderCard({ myRole: 'OWNER' });
    expect(screen.getByText('You: owner')).toBeInTheDocument();
  });
});
