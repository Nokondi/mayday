import { CATEGORIES } from '@mayday/shared';

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
  type, category, urgency, sort, community, communities,
  onTypeChange, onCategoryChange, onUrgencyChange, onSortChange, onCommunityChange,
}: PostFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">All Types</option>
        <option value="REQUEST">Requests</option>
        <option value="OFFER">Offers</option>
      </select>

      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {communities && communities.length > 0 && onCommunityChange && (
        <select
          value={community ?? ''}
          onChange={(e) => onCommunityChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All Communities</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <select
        value={urgency}
        onChange={(e) => onUrgencyChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value="">All Urgency</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>

      {onSortChange && (
        <select
          value={sort ?? 'recent'}
          onChange={(e) => onSortChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="recent">Most Recent</option>
          <option value="urgency">Most Urgent</option>
        </select>
      )}
    </div>
  );
}
