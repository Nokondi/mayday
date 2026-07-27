import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import type { PostType } from "@mayday/shared";

export const postTypeLabels = defineMessages({
  REQUEST: { id: "posts.types.request", defaultMessage: "Request" },
  OFFER: { id: "posts.types.offer", defaultMessage: "Offer" },
  EVENT: { id: "posts.types.event", defaultMessage: "Event" },
});

// One place for the per-type color scheme: orange = request, green = offer,
// purple = event. Blue and gray are taken by status/community badges.
export const postTypeStyles: Record<
  PostType,
  { chip: string; cardBorder: string; calendarChip: string }
> = {
  REQUEST: {
    chip: "bg-orange-100 text-orange-700",
    cardBorder: "border-l-orange-700",
    calendarChip:
      "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100",
  },
  OFFER: {
    chip: "bg-green-100 text-green-700",
    cardBorder: "border-l-green-700",
    calendarChip:
      "bg-green-50 text-green-800 border-green-200 hover:bg-green-100",
  },
  EVENT: {
    chip: "bg-purple-100 text-purple-700",
    cardBorder: "border-l-purple-700",
    calendarChip:
      "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
  },
};

export function PostTypeBadge({ type }: { type: PostType }) {
  const intl = useIntl();
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${postTypeStyles[type].chip}`}
    >
      <span className="sr-only">
        <FormattedMessage
          id="posts.typeAriaPrefix"
          defaultMessage="Post type: "
        />
      </span>
      {intl.formatMessage(postTypeLabels[type])}
    </span>
  );
}
