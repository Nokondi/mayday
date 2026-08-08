import { CATEGORIES } from "@mayday/shared";
import { useIntl } from "react-intl";

interface PostFiltersProps {
  type: string;
  category: string;
  urgency: string;
  sort?: string;
  community?: string;
  communities?: Array<{ id: string; name: string }>;
  onTypeChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onUrgencyChange: (v: string) => void;
  onSortChange?: (v: string) => void;
  onCommunityChange?: (v: string) => void;
}

export function PostFilters({
  type,
  category,
  urgency,
  sort,
  community,
  communities,
  onTypeChange,
  onCategoryChange,
  onUrgencyChange,
  onSortChange,
  onCommunityChange,
}: PostFiltersProps) {
  const intl = useIntl();

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={type}
        aria-label={intl.formatMessage({
          id: "posts.filters.typeAria",
          defaultMessage: "Filter by type",
        })}
        onChange={(e) => onTypeChange(e.target.value)}
        className="border border-mayday-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">
          {intl.formatMessage({
            id: "posts.filters.allTypes",
            defaultMessage: "All Types",
          })}
        </option>
        <option value="REQUEST">
          {intl.formatMessage({
            id: "posts.filters.requests",
            defaultMessage: "Requests",
          })}
        </option>
        <option value="OFFER">
          {intl.formatMessage({
            id: "posts.filters.offers",
            defaultMessage: "Offers",
          })}
        </option>
        <option value="EVENT">
          {intl.formatMessage({
            id: "posts.filters.events",
            defaultMessage: "Events",
          })}
        </option>
        <option value="COMMS">
          {intl.formatMessage({
            id: "posts.filters.comms",
            defaultMessage: "Comms",
          })}
        </option>
      </select>

      <select
        value={category}
        aria-label={intl.formatMessage({
          id: "posts.filters.categoryAria",
          defaultMessage: "Filter by category",
        })}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="border border-mayday-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">
          {intl.formatMessage({
            id: "posts.filters.allCategories",
            defaultMessage: "All Categories",
          })}
        </option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {onCommunityChange && (
        <select
          value={community ?? ""}
          aria-label={intl.formatMessage({
            id: "posts.filters.communityAria",
            defaultMessage: "Filter by community or friends",
          })}
          onChange={(e) => onCommunityChange(e.target.value)}
          className="border border-mayday-300 rounded-lg px-3 py-2 text-sm bg-white w-40 truncate"
        >
          <option value="">
            {intl.formatMessage({
              id: "posts.filters.allCommunities",
              defaultMessage: "All Communities",
            })}
          </option>
          <option value="friends">
            {intl.formatMessage({
              id: "posts.filters.friends",
              defaultMessage: "Friends",
            })}
          </option>
          {communities?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={urgency}
        aria-label={intl.formatMessage({
          id: "posts.filters.urgencyAria",
          defaultMessage: "Filter by urgency",
        })}
        onChange={(e) => onUrgencyChange(e.target.value)}
        className="border border-mayday-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">
          {intl.formatMessage({
            id: "posts.filters.allUrgency",
            defaultMessage: "All Urgency",
          })}
        </option>
        <option value="LOW">
          {intl.formatMessage({ id: "urgency.low", defaultMessage: "Low" })}
        </option>
        <option value="MEDIUM">
          {intl.formatMessage({
            id: "urgency.medium",
            defaultMessage: "Medium",
          })}
        </option>
        <option value="HIGH">
          {intl.formatMessage({ id: "urgency.high", defaultMessage: "High" })}
        </option>
        <option value="CRITICAL">
          {intl.formatMessage({
            id: "urgency.critical",
            defaultMessage: "Critical",
          })}
        </option>
      </select>

      {onSortChange && (
        <select
          value={sort ?? "recent"}
          aria-label={intl.formatMessage({
            id: "posts.filters.sortAria",
            defaultMessage: "Sort posts",
          })}
          onChange={(e) => onSortChange(e.target.value)}
          className="border border-mayday-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="recent">
            {intl.formatMessage({
              id: "posts.filters.sortRecent",
              defaultMessage: "Most Recent",
            })}
          </option>
          <option value="urgency">
            {intl.formatMessage({
              id: "posts.filters.sortUrgency",
              defaultMessage: "Most Urgent",
            })}
          </option>
        </select>
      )}
    </div>
  );
}
