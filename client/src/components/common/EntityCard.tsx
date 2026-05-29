import { Link } from "react-router-dom";
import { MapPin, Users } from "lucide-react";
import { FormattedMessage } from "react-intl";

interface EntityCardProps {
  to: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  memberCount: number;
  location?: string | null;
  myRole?: string | null;
}

export function EntityCard({
  to,
  name,
  description,
  avatarUrl,
  memberCount,
  location,
  myRole,
}: EntityCardProps) {
  return (
    <Link
      to={to}
      className="block bg-white rounded-lg border border-mayday-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0 mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
          {description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2 break-words">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <FormattedMessage
            id="common.entityCard.memberCount"
            defaultMessage="{count, plural, one {# member} other {# members}}"
            values={{ count: memberCount }}
          />
        </span>
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {location}
          </span>
        )}
        {myRole && (
          <span className="text-mayday-600 font-medium">
            <FormattedMessage
              id="common.entityCard.viewerRole"
              defaultMessage="You: {role}"
              values={{ role: myRole.toLowerCase() }}
            />
          </span>
        )}
      </div>
    </Link>
  );
}
