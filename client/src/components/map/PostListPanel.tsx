import { X } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import type { PostWithAuthor } from "@mayday/shared";
import { PostCard } from "../posts/PostCard.js";

interface PostListPanelProps {
  posts: PostWithAuthor[];
  onClose: () => void;
}

/**
 * Lists the posts at a clicked map pin or co-located cluster. Renders as a
 * bottom sheet on mobile and a left sidebar on md+ screens. Renders nothing
 * when there are no selected posts.
 */
export function PostListPanel({ posts, onClose }: PostListPanelProps) {
  const intl = useIntl();

  if (posts.length === 0) return null;

  return (
    <aside
      aria-label={intl.formatMessage({
        id: "map.postListPanel.landmarkLabel",
        defaultMessage: "Posts at this location",
      })}
      className="absolute inset-x-0 bottom-0 z-[1000] flex max-h-[55%] flex-col rounded-t-lg bg-white shadow-lg md:inset-y-0 md:bottom-auto md:left-0 md:right-auto md:w-96 md:max-h-full md:rounded-none md:rounded-r-lg"
    >
      <div className="flex items-center justify-between border-b border-mayday-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          <FormattedMessage
            id="map.postListPanel.heading"
            defaultMessage="{count, plural, one {# post here} other {# posts here}}"
            values={{ count: posts.length }}
          />
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={intl.formatMessage({
            id: "map.postListPanel.closeAriaLabel",
            defaultMessage: "Close list",
          })}
          className="flex-shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </aside>
  );
}
