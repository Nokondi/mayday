import { useMemo, useState } from 'react';
import { addHours, format, startOfDay } from 'date-fns';
import { FormattedMessage, useIntl } from 'react-intl';
import { layoutDay } from '../../utils/dayLayout.js';
import type { Occurrence } from '../../utils/recurrence.js';
import { postTypeStyles } from '../common/PostTypeBadge.js';

const HOUR_PX = 48;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 19;

interface DayViewProps {
  date: Date;
  occurrences: Occurrence[];
  /** Called when an event is clicked, so the parent can preview the post. */
  onSelectOccurrence: (occurrence: Occurrence) => void;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function DayView({
  date,
  occurrences,
  onSelectOccurrence,
}: DayViewProps) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);

  // Visible window: business hours by default, but always widened to cover any
  // occurrence that falls outside them. The toggle forces the full 24h day.
  const { startHour, endHour } = useMemo(() => {
    if (expanded) return { startHour: 0, endHour: 24 };
    let start = DEFAULT_START_HOUR;
    let end = DEFAULT_END_HOUR;
    for (const occ of occurrences) {
      const startMin = minutesSinceMidnight(occ.start);
      const endMin = occ.end
        ? startMin + (occ.end.getTime() - occ.start.getTime()) / 60000
        : startMin + 60;
      start = Math.min(start, Math.floor(startMin / 60));
      end = Math.max(end, Math.ceil(endMin / 60));
    }
    return {
      startHour: Math.max(0, start),
      endHour: Math.min(24, Math.max(end, start + 1)),
    };
  }, [occurrences, expanded]);

  const positioned = useMemo(
    () => layoutDay(occurrences, startHour, endHour),
    [occurrences, startHour, endHour],
  );

  const base = startOfDay(date);
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = startHour; h < endHour; h++) list.push(h);
    return list;
  }, [startHour, endHour]);

  const timelineHeight = (endHour - startHour) * HOUR_PX;

  return (
    <div className="bg-white border border-mayday-200 rounded-lg p-4">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-mayday-700 hover:text-mayday-800 hover:underline"
        >
          {expanded ? (
            <FormattedMessage
              id="calendar.day.showBusinessHours"
              defaultMessage="Show business hours"
            />
          ) : (
            <FormattedMessage
              id="calendar.day.showFullDay"
              defaultMessage="Show full day"
            />
          )}
        </button>
      </div>

      {occurrences.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          <FormattedMessage
            id="calendar.day.noEvents"
            defaultMessage="No events scheduled for this day."
          />
        </p>
      ) : (
        <div className="flex">
          {/* Hour labels gutter — absolutely positioned to the same
              `i * HOUR_PX` coordinates as the timeline gridlines so the two
              columns stay aligned regardless of row count. */}
          <div className="relative w-16 shrink-0" style={{ height: timelineHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                style={{ top: i * HOUR_PX }}
                className="absolute right-2 -translate-y-1/2 text-xs text-gray-500"
              >
                {format(addHours(base, h), 'h a')}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div
            className="relative flex-1 border-l border-mayday-200"
            style={{ height: timelineHeight }}
            aria-label={intl.formatMessage({
              id: 'calendar.day.scheduleAriaLabel',
              defaultMessage: 'Hourly schedule',
            })}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                style={{ top: i * HOUR_PX }}
                className="absolute left-0 right-0 border-t border-mayday-100"
              />
            ))}
            {positioned.map((p, i) => {
              const color = postTypeStyles[p.occ.post.type].calendarChip;
              return (
                <button
                  key={`${p.occ.post.id}-${i}`}
                  type="button"
                  onClick={() => onSelectOccurrence(p.occ)}
                  style={{
                    top: `${p.topPct}%`,
                    height: `${p.heightPct}%`,
                    left: `calc(${p.leftPct}% + 2px)`,
                    width: `calc(${p.widthPct}% - 4px)`,
                  }}
                  className={`absolute overflow-hidden rounded border px-1.5 py-0.5 text-xs leading-tight text-left ${color}`}
                  title={intl.formatMessage(
                    {
                      id: 'calendar.eventChipTitle',
                      defaultMessage: '{time} — {title}',
                    },
                    {
                      time: format(p.occ.start, 'h:mm a'),
                      title: p.occ.post.title,
                    },
                  )}
                >
                  <span className="font-medium">
                    {format(p.occ.start, 'h:mm a')}
                  </span>
                  <span className="block truncate">{p.occ.post.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
