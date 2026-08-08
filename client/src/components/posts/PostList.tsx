import { useState } from 'react';
import type { PostWithAuthor } from '@mayday/shared';
import { FormattedMessage } from 'react-intl';
import { PostCard } from './PostCard.js';
import { PostDetailContent } from './PostDetailContent.js';
import { postTypeStyles } from '../common/PostTypeBadge.js';

export function PostList({ posts }: { posts: PostWithAuthor[] }) {
  // Clicking a card expands it in place instead of navigating to the detail
  // page; one post at a time keeps the list scannable.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <FormattedMessage
          id="posts.postList.emptyState"
          defaultMessage="No posts found. Try adjusting your filters."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) =>
        post.id === expandedId ? (
          <div
            key={post.id}
            className={`bg-white rounded-lg border border-mayday-200 border-l-4 ${postTypeStyles[post.type].cardBorder} p-6`}
          >
            <PostDetailContent
              post={post}
              variant="card"
              onCollapse={() => setExpandedId(null)}
              onDeleted={() => setExpandedId(null)}
            />
          </div>
        ) : (
          <PostCard
            key={post.id}
            post={post}
            onExpand={() => setExpandedId(post.id)}
          />
        ),
      )}
    </div>
  );
}
