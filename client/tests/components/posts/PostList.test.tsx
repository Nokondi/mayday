import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PostWithAuthor } from '@mayday/shared';
import { PostList } from '../../../src/components/posts/PostList.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Need help',
    description: 'Short description',
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

function renderList(posts: PostWithAuthor[]) {
  return render(
    <MemoryRouter>
      <PostList posts={posts} />
    </MemoryRouter>,
  );
}

describe('PostList', () => {
  it('renders an empty-state message when there are no posts', () => {
    renderList([]);
    expect(screen.getByText(/no posts found\. try adjusting your filters/i)).toBeInTheDocument();
  });

  it('does not render any post cards when empty', () => {
    renderList([]);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders one PostCard per post when posts are provided', () => {
    renderList([
      makePost({ id: 'p1', title: 'First' }),
      makePost({ id: 'p2', title: 'Second' }),
      makePost({ id: 'p3', title: 'Third' }),
    ]);

    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Third' })).toBeInTheDocument();
  });

  it('each rendered post card links to its detail page', () => {
    renderList([
      makePost({ id: 'p1', title: 'First' }),
      makePost({ id: 'p2', title: 'Second' }),
    ]);
    const links = screen.getAllByRole('link');
    // The outer card is a link; each heading is inside its own link.
    expect(links.some((a) => a.getAttribute('href') === '/posts/p1')).toBe(true);
    expect(links.some((a) => a.getAttribute('href') === '/posts/p2')).toBe(true);
  });

  it('does not render the empty-state message when posts are present', () => {
    renderList([makePost()]);
    expect(screen.queryByText(/no posts found/i)).not.toBeInTheDocument();
  });
});
