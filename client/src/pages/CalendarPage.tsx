import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { getPosts } from '../api/posts.js';
import { listMyCommunities } from '../api/communities.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { PostFilters } from '../components/posts/PostFilters.js';
import { SearchBar } from '../components/common/SearchBar.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { expandOccurrences, type Occurrence } from '../utils/recurrence.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENTS_PER_CELL = 3;

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [community, setCommunity] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor)), [cursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor)), [cursor]);
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities'],
    queryFn: listMyCommunities,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'scheduled', { type, category, urgency, community, q: debouncedSearch }],
    queryFn: () => getPosts({
      scheduled: true,
      status: 'OPEN',
      limit: 200,
      type: (type as 'REQUEST' | 'OFFER') || undefined,
      category: category || undefined,
      urgency: (urgency as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') || undefined,
      communityId: community || undefined,
      q: debouncedSearch || undefined,
    }),
  });

  const occurrencesByDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    if (!data) return map;
    for (const post of data.data) {
      const occs = expandOccurrences(post, gridStart, gridEnd);
      for (const occ of occs) {
        const key = format(occ.start, 'yyyy-MM-dd');
        const list = map.get(key) ?? [];
        list.push(occ);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [data, gridStart, gridEnd]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{format(cursor, 'MMMM yyyy')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(subMonths(cursor, 1))}
            aria-label="Previous month"
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search events..."
        />
        <PostFilters
          type={type} category={category} urgency={urgency}
          community={community} communities={myCommunities}
          onTypeChange={setType}
          onCategoryChange={setCategory}
          onUrgencyChange={setUrgency}
          onCommunityChange={setCommunity}
        />
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayOccs = occurrencesByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const isToday = isSameDay(day, new Date());
              const visible = dayOccs.slice(0, MAX_EVENTS_PER_CELL);
              const overflow = dayOccs.length - visible.length;
              return (
                <div
                  key={key}
                  className={`min-h-[100px] border-b border-r border-gray-200 p-1.5 ${inMonth ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <div
                    className={`text-xs mb-1 ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-mayday-500 text-white font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-500'}`}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((occ, i) => {
                      const color =
                        occ.post.type === 'REQUEST'
                          ? 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                          : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100';
                      return (
                        <Link
                          key={`${occ.post.id}-${i}`}
                          to={`/posts/${occ.post.id}`}
                          className={`block text-[11px] leading-tight truncate rounded px-1.5 py-0.5 border ${color}`}
                          title={`${format(occ.start, 'h:mm a')} — ${occ.post.title}`}
                        >
                          <span className="font-medium">{format(occ.start, 'h:mma').toLowerCase()}</span>{' '}
                          {occ.post.title}
                        </Link>
                      );
                    })}
                    {overflow > 0 && (
                      <div className="text-[11px] text-gray-500 px-1.5">+{overflow} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
