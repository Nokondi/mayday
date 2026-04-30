import { Link } from "react-router-dom";
import {
  MapPin,
  Clock,
  User,
  Building2,
  Lock,
  CheckCircle,
  Calendar,
  Repeat,
} from "lucide-react";
import { formatDistanceToNow, format, isSameDay } from "date-fns";
import type { PostWithAuthor, RecurrenceFrequency } from "@mayday/shared";
import { CategoryBadge } from "../common/CategoryBadge.js";
import { UrgencyBadge } from "../common/UrgencyBadge.js";

function formatSchedule(
  startAt: string | null,
  endAt: string | null,
): string | null {
  if (!startAt && !endAt) return null;
  const dateFmt = "MMM d, h:mm a";
  const timeFmt = "h:mm a";
  if (startAt && endAt) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isSameDay(start, end))
      return `${format(start, dateFmt)} – ${format(end, timeFmt)}`;
    return `${format(start, dateFmt)} – ${format(end, dateFmt)}`;
  }
  if (startAt) return `Starts ${format(new Date(startAt), dateFmt)}`;
  return `Ends ${format(new Date(endAt!), dateFmt)}`;
}

export function formatRecurrence(
  freq: RecurrenceFrequency | null,
  interval: number | null,
): string | null {
  if (!freq || !interval) return null;
  const unit = freq === "DAY" ? "day" : freq === "WEEK" ? "week" : "month";
  return interval === 1 ? `every ${unit}` : `every ${interval} ${unit}s`;
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const typeColor =
    post.type === "REQUEST" ? "border-l-orange-400" : "border-l-green-400";

  const typeLabel = post.type === "REQUEST" ? "Request" : "Offer";

  return (
    <Link
      to={`/posts/${post.id}`}
      className={`block bg-white rounded-lg border border-gray-200 border-l-4 ${typeColor} p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-2 mb-1">
            <span
              className={`text-xs font-semibold uppercase ${post.type === "REQUEST" ? "text-orange-600" : "text-green-600"}`}
            >
              <span className="sr-only">Post type: </span>
              {typeLabel}
            </span>
            <div className="flex items-center gap-2">
              {post.images?.length > 0 && (
                <img
                  src={post.images[0].url}
                  alt={post.title}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {post.title}
                </h3>
                <div className="flex flew-row flex-wrap items-center gap-2 mb-1">
                  <CategoryBadge category={post.category} />
                  <UrgencyBadge urgency={post.urgency} />
                  {post.status === "FULFILLED" && (
                    <span className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      <CheckCircle className="w-3 h-3" aria-hidden="true" />
                      Fulfilled
                    </span>
                  )}
                  {post.status === "CLOSED" && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      Closed
                    </span>
                  )}
                  {post.community && (
                    <span className="flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      {post.community.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {post.description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3 text-xs text-gray-500">
            {post.organization ? (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" aria-hidden="true" />
                {post.organization.name}
                <span className="text-gray-500">· by {post.author.name}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" aria-hidden="true" />
                {post.author.name}
              </span>
            )}
            {post.location && post.latitude && post.longitude && (
              <Link
                to={`/map?lat=${post.latitude}&lng=${post.longitude}&zoom=15`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-mayday-600"
              >
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {post.location}
              </Link>
            )}
            {post.location && (!post.latitude || !post.longitude) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {post.location}
              </span>
            )}
            {(() => {
              const schedule = formatSchedule(post.startAt, post.endAt);
              return schedule ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  {schedule}
                </span>
              ) : null;
            })()}
            {(() => {
              const repeat = formatRecurrence(
                post.recurrenceFreq,
                post.recurrenceInterval,
              );
              return repeat ? (
                <span className="flex items-center gap-1">
                  <Repeat className="w-3 h-3" aria-hidden="true" />
                  {repeat}
                </span>
              ) : null;
            })()}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
