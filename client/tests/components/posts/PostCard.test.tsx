import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { PostWithAuthor } from '@mayday/shared';
import { PostCard } from '../../../src/components/posts/PostCard.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Need help',
    description: 'Some description',
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

function renderCard(post: PostWithAuthor) {
  return render(
    <MemoryRouter>
      <PostCard post={post} />
    </MemoryRouter>,
  );
}

describe('PostCard — basic rendering', () => {
  it('links to the post detail page', () => {
    renderCard(makePost({ id: 'abc123' }));
    const links = screen.getAllByRole('link');
    // The outer card is the first link; its href is /posts/:id.
    expect(links[0]).toHaveAttribute('href', '/posts/abc123');
  });

  it('renders the title and description', () => {
    renderCard(makePost({ title: 'Need groceries', description: 'Short on funds' }));
    expect(screen.getByRole('heading', { name: 'Need groceries' })).toBeInTheDocument();
    expect(screen.getByText('Short on funds')).toBeInTheDocument();
  });

  it('renders the CategoryBadge and UrgencyBadge', () => {
    renderCard(makePost({ category: 'Housing', urgency: 'HIGH' }));
    expect(screen.getByText('Housing')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows a relative-time line ending in "ago"', () => {
    renderCard(makePost());
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });
});

describe('PostCard — type label and styling', () => {
  it('labels request posts as "Request" with orange accents', () => {
    const { container } = renderCard(makePost({ type: 'REQUEST' }));
    expect(screen.getByText('Request')).toBeInTheDocument();
    // The outer link carries the left-border color.
    const card = container.querySelector('a');
    expect(card).toHaveClass('border-l-orange-400');
  });

  it('labels offer posts as "Offer" with green accents', () => {
    const { container } = renderCard(makePost({ type: 'OFFER' }));
    expect(screen.getByText('Offer')).toBeInTheDocument();
    const card = container.querySelector('a');
    expect(card).toHaveClass('border-l-green-400');
  });
});

describe('PostCard — author vs organization attribution', () => {
  it('shows only the author when there is no organization', () => {
    renderCard(
      makePost({
        author: {
          id: 'u1',
          name: 'Alice',
          bio: null,
          location: null,
          skills: [],
          avatarUrl: null,
          createdAt: '2020-01-01T00:00:00Z',
        },
      }),
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText(/by Alice/i)).not.toBeInTheDocument();
  });

  it('shows the organization name with a "· by <author>" suffix when posted by an org', () => {
    renderCard(
      makePost({
        organization: { id: 'o1', name: 'Red Cross', avatarUrl: null },
        author: {
          id: 'u1',
          name: 'Alice',
          bio: null,
          location: null,
          skills: [],
          avatarUrl: null,
          createdAt: '2020-01-01T00:00:00Z',
        },
      }),
    );
    expect(screen.getByText('Red Cross')).toBeInTheDocument();
    expect(screen.getByText(/by Alice/i)).toBeInTheDocument();
  });
});

describe('PostCard — status badges', () => {
  it('shows a "Fulfilled" badge when the post status is FULFILLED', () => {
    renderCard(makePost({ status: 'FULFILLED' }));
    expect(screen.getByText('Fulfilled')).toBeInTheDocument();
  });

  it('shows a "Closed" badge when the post status is CLOSED', () => {
    renderCard(makePost({ status: 'CLOSED' }));
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('does not show a status badge when the post is OPEN', () => {
    renderCard(makePost({ status: 'OPEN' }));
    expect(screen.queryByText('Fulfilled')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });
});

describe('PostCard — community badge', () => {
  it('renders the community name when the post is scoped to a community', () => {
    renderCard(makePost({ community: { id: 'c1', name: 'Neighborhood Watch' } }));
    expect(screen.getByText('Neighborhood Watch')).toBeInTheDocument();
  });

  it('does not render a community badge when community is null', () => {
    renderCard(makePost({ community: null }));
    expect(screen.queryByText('Neighborhood Watch')).not.toBeInTheDocument();
  });
});

describe('PostCard — image preview', () => {
  it('renders the first image when images exist, with an alt that references the title', () => {
    renderCard(
      makePost({
        title: 'Bike for offer',
        images: [
          { id: 'i1', url: 'https://example.com/a.jpg', order: 0 },
          { id: 'i2', url: 'https://example.com/b.jpg', order: 1 },
        ],
      }),
    );
    const img = screen.getByAltText(/image for bike for offer/i) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/a.jpg');
  });

  it('does not render an image when the post has no images', () => {
    const { container } = renderCard(makePost({ images: [] }));
    expect(container.querySelector('img')).toBeNull();
  });
});

// The outer card is itself a <Link>, so its accessible name includes every
// text inside it (location included). These helpers find only the *inner*
// location-related link by its href pattern rather than by accessible name.
function findMapLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>('a[href^="/map"]');
}
function findCardLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>('a[href^="/posts/"]');
}

describe('PostCard — location rendering', () => {
  it('renders a map link when location has coordinates', () => {
    const { container } = renderCard(
      makePost({ location: 'Little Rock, AR', latitude: 34.7465, longitude: -92.2896 }),
    );
    const mapLink = findMapLink(container);
    expect(mapLink).not.toBeNull();
    expect(mapLink).toHaveAttribute(
      'href',
      '/map?lat=34.7465&lng=-92.2896&zoom=15',
    );
    expect(mapLink).toHaveTextContent('Little Rock, AR');
  });

  it('renders the location as plain text (no map link) when coordinates are missing', () => {
    const { container } = renderCard(
      makePost({ location: 'Somewhere', latitude: null, longitude: null }),
    );
    expect(screen.getByText('Somewhere')).toBeInTheDocument();
    expect(findMapLink(container)).toBeNull();
  });

  it('renders nothing for location when location is null', () => {
    const { container } = renderCard(makePost({ location: null }));
    expect(findMapLink(container)).toBeNull();
    // Also sanity-check: no stray location string left over from the default.
    expect(screen.queryByText(/little rock/i)).not.toBeInTheDocument();
  });

  it('stops the click event from bubbling so the outer post link does not also navigate', async () => {
    const user = userEvent.setup();
    function LocationProbe() {
      const location = useLocation();
      return <div data-testid="location">{location.pathname + location.search}</div>;
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/posts']}>
        <Routes>
          <Route
            path="/posts"
            element={
              <>
                <PostCard
                  post={makePost({
                    id: 'p1',
                    location: 'Town',
                    latitude: 1,
                    longitude: 2,
                  })}
                />
                <LocationProbe />
              </>
            }
          />
          <Route path="/map" element={<><div>MAP PAGE</div><LocationProbe /></>} />
          <Route path="/posts/:id" element={<><div>DETAIL PAGE</div><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    const mapLink = findMapLink(container)!;
    expect(mapLink).not.toBeNull();
    await user.click(mapLink);

    // The map link won — no stray navigation to /posts/:id.
    expect(screen.getByText('MAP PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toMatch(/^\/map\?/);
  });

  it('keeps the outer card link pointing at the post detail even when a map link is rendered', () => {
    const { container } = renderCard(
      makePost({ id: 'p1', location: 'Town', latitude: 1, longitude: 2 }),
    );
    expect(findCardLink(container)).toHaveAttribute('href', '/posts/p1');
  });
});
