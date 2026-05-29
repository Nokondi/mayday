import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import { getPosts } from "../api/posts.js";
import { listMyCommunities } from "../api/communities.js";
import { DayView } from "../components/calendar/DayView.js";
import { PostPreviewDialog } from "../components/calendar/PostPreviewDialog.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { PostFilters } from "../components/posts/PostFilters.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { expandOccurrences, type Occurrence } from "../utils/recurrence.js";

type CalendarView = "month" | "day";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const weekdayMessages = defineMessages({
  sun: { id: "calendar.weekday.sun", defaultMessage: "Sun" },
  mon: { id: "calendar.weekday.mon", defaultMessage: "Mon" },
  tue: { id: "calendar.weekday.tue", defaultMessage: "Tue" },
  wed: { id: "calendar.weekday.wed", defaultMessage: "Wed" },
  thu: { id: "calendar.weekday.thu", defaultMessage: "Thu" },
  fri: { id: "calendar.weekday.fri", defaultMessage: "Fri" },
  sat: { id: "calendar.weekday.sat", defaultMessage: "Sat" },
});

const navMessages = defineMessages({
  previousMonth: {
    id: "calendar.previousMonthAriaLabel",
    defaultMessage: "Previous month",
  },
  nextMonth: { id: "calendar.nextMonthAriaLabel", defaultMessage: "Next month" },
  previousDay: {
    id: "calendar.previousDayAriaLabel",
    defaultMessage: "Previous day",
  },
  nextDay: { id: "calendar.nextDayAriaLabel", defaultMessage: "Next day" },
});

const MAX_EVENTS_PER_CELL = 3;

export function CalendarPage() {
  const intl = useIntl();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [community, setCommunity] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor)), [cursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor)), [cursor]);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const { data: myCommunities } = useQuery({
    queryKey: ["my-communities"],
    queryFn: listMyCommunities,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "posts",
      "scheduled",
      { type, category, urgency, community, q: debouncedSearch },
    ],
    queryFn: () =>
      getPosts({
        scheduled: true,
        status: "OPEN",
        limit: 200,
        type: (type as "REQUEST" | "OFFER") || undefined,
        category: category || undefined,
        urgency:
          (urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") || undefined,
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
        const key = format(occ.start, "yyyy-MM-dd");
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
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {view === "month"
            ? format(cursor, "MMMM yyyy")
            : format(cursor, "EEEE, MMMM d, yyyy")}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-mayday-300 overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
              className={`px-3 py-2 text-sm ${view === "month" ? "bg-mayday-700 text-white" : "bg-white hover:bg-mayday-50"}`}
            >
              <FormattedMessage
                id="calendar.monthViewButton"
                defaultMessage="Month"
              />
            </button>
            <button
              type="button"
              onClick={() => setView("day")}
              aria-pressed={view === "day"}
              className={`px-3 py-2 text-sm border-l border-mayday-300 ${view === "day" ? "bg-mayday-700 text-white" : "bg-white hover:bg-mayday-50"}`}
            >
              <FormattedMessage
                id="calendar.dayViewButton"
                defaultMessage="Day"
              />
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              setCursor(
                view === "month" ? subMonths(cursor, 1) : subDays(cursor, 1),
              )
            }
            aria-label={intl.formatMessage(
              view === "month" ? navMessages.previousMonth : navMessages.previousDay,
            )}
            className="p-2 rounded-lg border border-mayday-300 bg-white hover:bg-mayday-50"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-3 py-2 text-sm rounded-lg border border-mayday-300 bg-white hover:bg-mayday-50"
          >
            <FormattedMessage
              id="calendar.todayButton"
              defaultMessage="Today"
            />
          </button>
          <button
            type="button"
            onClick={() =>
              setCursor(
                view === "month" ? addMonths(cursor, 1) : addDays(cursor, 1),
              )
            }
            aria-label={intl.formatMessage(
              view === "month" ? navMessages.nextMonth : navMessages.nextDay,
            )}
            className="p-2 rounded-lg border border-mayday-300 bg-white hover:bg-mayday-50"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={intl.formatMessage({
            id: "calendar.searchPlaceholder",
            defaultMessage: "Search events...",
          })}
        />
        <PostFilters
          type={type}
          category={category}
          urgency={urgency}
          community={community}
          communities={myCommunities}
          onTypeChange={setType}
          onCategoryChange={setCategory}
          onUrgencyChange={setUrgency}
          onCommunityChange={setCommunity}
        />
      </div>

      <PostPreviewDialog
        occurrence={selected}
        onClose={() => setSelected(null)}
      />

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : view === "day" ? (
        <DayView
          date={cursor}
          occurrences={occurrencesByDay.get(format(cursor, "yyyy-MM-dd")) ?? []}
          onSelectOccurrence={setSelected}
        />
      ) : (
        <div className="bg-white border border-mayday-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 border-b border-mayday-200 bg-gray-50">
            {WEEKDAY_KEYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-xs font-semibold text-gray-500 text-center"
              >
                {intl.formatMessage(weekdayMessages[d])}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayOccs = occurrencesByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const isToday = isSameDay(day, new Date());
              const visible = dayOccs.slice(0, MAX_EVENTS_PER_CELL);
              const overflow = dayOccs.length - visible.length;
              return (
                <div
                  key={key}
                  className={`relative min-h-[100px] border-b border-r border-mayday-200 ${inMonth ? "bg-white" : "bg-gray-50"}`}
                >
                  {/* Full-cell click target navigates to the day view. It sits
                      behind the content; the event chips re-enable pointer
                      events so a click on a chip still opens its post. */}
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(day);
                      setView("day");
                    }}
                    aria-label={intl.formatMessage(
                      {
                        id: "calendar.viewDayAriaLabel",
                        defaultMessage: "View {date}",
                      },
                      { date: format(day, "EEEE, MMMM d, yyyy") },
                    )}
                    className="absolute inset-0 w-full hover:bg-mayday-50 focus-visible:bg-mayday-50"
                  />
                  <div className="relative pointer-events-none p-1.5">
                    <div
                      className={`text-xs mb-1 ${isToday ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-mayday-700 text-white font-semibold" : inMonth ? "text-gray-700" : "text-gray-500"}`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {visible.map((occ, i) => {
                        const color =
                          occ.post.type === "REQUEST"
                            ? "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100"
                            : "bg-green-50 text-green-800 border-green-200 hover:bg-green-100";
                        return (
                          <button
                            key={`${occ.post.id}-${i}`}
                            type="button"
                            onClick={() => setSelected(occ)}
                            className={`pointer-events-auto block w-full text-left text-[11px] leading-tight truncate rounded px-1.5 py-0.5 border ${color}`}
                            title={intl.formatMessage(
                              {
                                id: "calendar.eventChipTitle",
                                defaultMessage: "{time} — {title}",
                              },
                              {
                                time: format(occ.start, "h:mm a"),
                                title: occ.post.title,
                              },
                            )}
                          >
                            <span className="font-medium">
                              {format(occ.start, "h:mma").toLowerCase()}
                            </span>
                            <span className="ml-1">{occ.post.title}</span>
                          </button>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="text-[11px] text-gray-500 px-1.5">
                          <FormattedMessage
                            id="calendar.moreEventsButton"
                            defaultMessage="+{count, plural, one {# more} other {# more}}"
                            values={{ count: overflow }}
                          />
                        </div>
                      )}
                    </div>
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
