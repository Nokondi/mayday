import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UserPublicProfile } from '@mayday/shared';
import { UserCard } from '../../../src/components/users/UserCard.js';

function makeUser(overrides: Partial<UserPublicProfile> = {}): UserPublicProfile {
  return {
    id: 'u1',
    name: 'Alice',
    bio: null,
    location: null,
    skills: [],
    avatarUrl: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderCard(user: UserPublicProfile) {
  return render(
    <MemoryRouter>
      <UserCard user={user} />
    </MemoryRouter>,
  );
}

describe('UserCard', () => {
  it('renders the user name', () => {
    renderCard(makeUser({ name: 'Alice Smith' }));
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('wraps the card in a link to the user profile', () => {
    renderCard(makeUser({ id: 'user-42' }));
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/profile/user-42');
    // The name is rendered inside the link, not elsewhere.
    expect(within(link).getByText('Alice')).toBeInTheDocument();
  });

  it('renders the location line when location is provided', () => {
    renderCard(makeUser({ location: 'Little Rock, AR' }));
    expect(screen.getByText('Little Rock, AR')).toBeInTheDocument();
  });

  it('does not render a location line when location is null', () => {
    const { container } = renderCard(makeUser({ location: null }));
    // The location block is a <p> with the MapPin icon; its absence is the signal.
    // Guard via an absent pattern rather than a negative location assertion so
    // a future "location: undefined" doesn't produce a false positive.
    expect(container.querySelectorAll('p').length).toBe(1); // only the name <p>
  });
});
