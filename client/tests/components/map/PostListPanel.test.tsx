import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';
import { PostListPanel } from '../../../src/components/map/PostListPanel.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    sharedWithFriends: false,
    title: 'Need help',
    description: 'Some description',
    category: 'Food',
    location: 'Somewhere',
    latitude: 34.7,
    longitude: -92.3,
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

function renderPanel(posts: PostWithAuthor[], onClose = vi.fn()) {
  render(
    <IntlProvider locale="en" defaultLocale="en">
      <MemoryRouter>
        <PostListPanel posts={posts} onClose={onClose} />
      </MemoryRouter>
    </IntlProvider>,
  );
  return { onClose };
}

describe('PostListPanel', () => {
  it('renders nothing when there are no posts', () => {
    const { container } = render(
      <IntlProvider locale="en" defaultLocale="en">
        <MemoryRouter>
          <PostListPanel posts={[]} onClose={vi.fn()} />
        </MemoryRouter>
      </IntlProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one card per post with a pluralized count heading', () => {
    renderPanel([
      makePost({ id: 'a', title: 'Need groceries' }),
      makePost({ id: 'b', title: 'Spare blankets' }),
    ]);
    expect(screen.getByRole('heading', { name: /2 posts here/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /need groceries/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spare blankets/i })).toBeInTheDocument();
  });

  it('uses the singular heading for a single post', () => {
    renderPanel([makePost({ id: 'a' })]);
    expect(screen.getByRole('heading', { name: /1 post here/i })).toBeInTheDocument();
  });

  it('exposes a labelled landmark', () => {
    renderPanel([makePost({ id: 'a' })]);
    expect(screen.getByRole('complementary', { name: /posts at this location/i })).toBeInTheDocument();
  });

  it('fires onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel([makePost({ id: 'a' })]);
    await user.click(screen.getByRole('button', { name: /close list/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
