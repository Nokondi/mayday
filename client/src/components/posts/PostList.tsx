import type { PostWithAuthor } from '@mayday/shared';
import { PostCard } from './PostCard.js';

export function PostList({ posts }: { posts: PostWithAuthor[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No posts found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
