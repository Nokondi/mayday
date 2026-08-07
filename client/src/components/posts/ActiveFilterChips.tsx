import { X } from "lucide-react";
import { useIntl, type MessageDescriptor } from "react-intl";

/** Keys that map 1:1 to the URL search params driving the post list. */
export type FilterKey =
  | "type"
  | "category"
  | "urgency"
  | "sort"
  | "community"
  | "q";

interface ActiveFilterChipsProps {
  type: string;
  category: string;
  urgency: string;
  sort: string;
  community: string;
  q: string;
  communities?: Array<{ id: string; name: string }>;
  onClear: (key: FilterKey) => void;
}

interface ChipDescriptor {
  key: FilterKey;
  label: string;
}

const TYPE_LABELS: Record<string, MessageDescriptor> = {
  REQUEST: { id: "posts.filters.requests", defaultMessage: "Requests" },
  OFFER: { id: "posts.filters.offers", defaultMessage: "Offers" },
  EVENT: { id: "posts.filters.events", defaultMessage: "Events" },
  COMMS: { id: "posts.filters.comms", defaultMessage: "Comms" },
};

const URGENCY_LABELS: Record<string, MessageDescriptor> = {
  LOW: { id: "urgency.low", defaultMessage: "Low" },
  MEDIUM: { id: "urgency.medium", defaultMessage: "Medium" },
  HIGH: { id: "urgency.high", defaultMessage: "High" },
  CRITICAL: { id: "urgency.critical", defaultMessage: "Critical" },
};

export function ActiveFilterChips({
  type,
  category,
  urgency,
  sort,
  community,
  q,
  communities,
  onClear,
}: ActiveFilterChipsProps) {
  const intl = useIntl();

  const chips: ChipDescriptor[] = [];

  if (q) {
    chips.push({
      key: "q",
      label: intl.formatMessage(
        {
          id: "posts.activeFilters.searchChip",
          defaultMessage: "Search: {q}",
        },
        { q },
      ),
    });
  }
  if (type && TYPE_LABELS[type]) {
    chips.push({ key: "type", label: intl.formatMessage(TYPE_LABELS[type]) });
  }
  if (category) {
    chips.push({ key: "category", label: category });
  }
  if (community === "friends") {
    chips.push({
      key: "community",
      label: intl.formatMessage({
        id: "posts.filters.friends",
        defaultMessage: "Friends",
      }),
    });
  } else if (community) {
    const name = communities?.find((c) => c.id === community)?.name;
    if (name) chips.push({ key: "community", label: name });
  }
  if (urgency && URGENCY_LABELS[urgency]) {
    chips.push({
      key: "urgency",
      label: intl.formatMessage(URGENCY_LABELS[urgency]),
    });
  }
  // Sort only yields a chip when it differs from the default chronological order.
  if (sort === "urgency") {
    chips.push({
      key: "sort",
      label: intl.formatMessage({
        id: "posts.filters.sortUrgency",
        defaultMessage: "Most Urgent",
      }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-mayday-800 text-white text-sm px-3 py-1"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onClear(chip.key)}
            aria-label={intl.formatMessage(
              {
                id: "posts.activeFilters.removeAria",
                defaultMessage: "Remove {label}",
              },
              { label: chip.label },
            )}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
