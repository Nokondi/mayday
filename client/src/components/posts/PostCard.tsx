import { Link } from "react-router-dom";
import {
  MapPin,
  Clock,
  User,
  Users,
  Building2,
  Lock,
  CheckCircle,
  Calendar,
  Repeat,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow, format, isSameDay } from "date-fns";
import {
  defineMessages,
  FormattedMessage,
  useIntl,
  type IntlShape,
} from "react-intl";
import type { PostWithAuthor, RecurrenceFrequency } from "@mayday/shared";
import { CategoryBadge } from "../common/CategoryBadge.js";
import { UrgencyBadge } from "../common/UrgencyBadge.js";

const typeLabels = defineMessages({
  REQUEST: { id: "posts.types.request", defaultMessage: "Request" },
  OFFER: { id: "posts.types.offer", defaultMessage: "Offer" },
});

const statusLabels = defineMessages({
  OPEN: { id: "posts.statuses.open", defaultMessage: "Open" },
  FULFILLED: { id: "posts.statuses.fulfilled", defaultMessage: "Fulfilled" },
  CLOSED: { id: "posts.statuses.closed", defaultMessage: "Closed" },
});

function formatSchedule(
  intl: IntlShape,
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
  if (startAt) {
    return intl.formatMessage(
      { id: "posts.schedule.startsAt", defaultMessage: "Starts {date}" },
      { date: format(new Date(startAt), dateFmt) },
    );
  }
  return intl.formatMessage(
    { id: "posts.schedule.endsAt", defaultMessage: "Ends {date}" },
    { date: format(new Date(endAt!), dateFmt) },
  );
}

/**
 * Render the human-readable recurrence ("every day", "every 3 weeks", etc.) for
 * a post. Returns null when the post doesn't recur. Takes `intl` so callers can
 * use the same translated formatter both in PostCard and PostDetailPage.
 */
export function formatRecurrence(
  intl: IntlShape,
  freq: RecurrenceFrequency | null,
  interval: number | null,
): string | null {
  if (!freq || !interval) return null;
  return intl.formatMessage(
    {
      id: "posts.recurrence",
      defaultMessage:
        "{count, plural, one {every {unit, select, DAY {day} WEEK {week} MONTH {month} other {month}}} other {every # {unit, select, DAY {days} WEEK {weeks} MONTH {months} other {months}}}}",
    },
    { count: interval, unit: freq },
  );
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const intl = useIntl();
  const typeColor =
    post.type === "REQUEST" ? "border-l-orange-700" : "border-l-green-700";

  return (
    <Link
      to={`/posts/${post.id}`}
      className={`block bg-white rounded-lg border border-mayday-200 border-l-4 ${typeColor} p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <div className="flex items-start gap-2">
              {post.author.avatarUrl ? (
                <img
                  src={post.author.avatarUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
                />
              ) : (
                <div className="w-8 h-8 bg-mayday-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-mayday-600" aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 truncate">
                  {post.author.name}
                </span>
                {post.organization && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Building2 className="w-3 h-3" aria-hidden="true" />
                    {post.organization.name}
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 truncate">
                  {post.title}
                </h3>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              {post.images?.length > 0 && (
                <img
                  src={post.images[0].url}
                  alt={post.title}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <p className="text-sm text-gray-600 line-clamp-3 break-words min-w-0 flex-1">
                {post.description}
              </p>
            </div>
          </div>
          <div className="flex flew-row flex-wrap items-center gap-2 mt-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                post.type === "REQUEST"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              <span className="sr-only">
                <FormattedMessage
                  id="posts.typeAriaPrefix"
                  defaultMessage="Post type: "
                />
              </span>
              {intl.formatMessage(typeLabels[post.type])}
            </span>
            <CategoryBadge category={post.category} />
            <UrgencyBadge urgency={post.urgency} />
            {post.status === "FULFILLED" && (
              <span className="flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                <CheckCircle className="w-3 h-3" aria-hidden="true" />
                {intl.formatMessage(statusLabels.FULFILLED)}
              </span>
            )}
            {post.status === "CLOSED" && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {intl.formatMessage(statusLabels.CLOSED)}
              </span>
            )}
            {post.sharedWithFriends && (
              <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                <Users className="w-3 h-3" aria-hidden="true" />
                {intl.formatMessage({
                  id: "posts.card.friendsBadge",
                  defaultMessage: "Friends",
                })}
              </span>
            )}
            {post.communities.map((community) => (
              <span
                key={community.id}
                className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                {community.name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-x-3 flex-wrap mt-1 text-xs text-gray-500">
            {post.location && post.latitude && post.longitude && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {post.location}
              </span>
            )}
            {post.location && (!post.latitude || !post.longitude) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {post.location}
              </span>
            )}
            {(() => {
              const schedule = formatSchedule(intl, post.startAt, post.endAt);
              return schedule ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" aria-hidden="true" />
                  {schedule}
                </span>
              ) : null;
            })()}
            {(() => {
              const repeat = formatRecurrence(
                intl,
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
            <span
              className="flex items-center gap-1"
              aria-label={intl.formatMessage(
                {
                  id: "posts.card.commentCountAria",
                  defaultMessage:
                    "{count, plural, one {# comment} other {# comments}}",
                },
                { count: post.commentCount },
              )}
            >
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
              {post.commentCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export { typeLabels, statusLabels };
