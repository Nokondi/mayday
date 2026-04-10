import { Link } from 'react-router-dom';
import { MapPin, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { PostWithAuthor } from '@mayday/shared';
import { CategoryBadge } from '../common/CategoryBadge.js';
import { UrgencyBadge } from '../common/UrgencyBadge.js';

export function PostCard({ post }: { post: PostWithAuthor }) {
  const typeColor = post.type === 'REQUEST'
    ? 'border-l-orange-400'
    : 'border-l-green-400';

  const typeLabel = post.type === 'REQUEST' ? 'Request' : 'Offer';

  return (
    <Link
      to={`/posts/${post.id}`}
      className={`block bg-white rounded-lg border border-gray-200 border-l-4 ${typeColor} p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase ${post.type === 'REQUEST' ? 'text-orange-600' : 'text-green-600'}`}>
              {typeLabel}
            </span>
            <CategoryBadge category={post.category} />
            <UrgencyBadge urgency={post.urgency} />
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{post.title}</h3>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{post.description}</p>
        </div>
        {post.images?.length > 0 && (
          <img
            src={post.images[0].url}
            alt=""
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {post.author.name}
        </span>
        {post.location && post.latitude && post.longitude && (
          <Link
            to={`/map?lat=${post.latitude}&lng=${post.longitude}&zoom=15`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 hover:text-mayday-600"
          >
            <MapPin className="w-3 h-3" />
            {post.location}
          </Link>
        )}
        {post.location && (!post.latitude || !post.longitude) && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {post.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
        </span>
      </div>
    </Link>
  );
}
