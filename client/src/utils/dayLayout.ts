import type { Occurrence } from './recurrence.js';

export interface PositionedOccurrence {
  occ: Occurrence;
  /** Percent offset from the top of the timeline. */
  topPct: number;
  /** Percent height relative to the timeline range. */
  heightPct: number;
  /** Percent offset from the left of the events lane. */
  leftPct: number;
  /** Percent width within the events lane. */
  widthPct: number;
}

// Events without an explicit end get a nominal duration so they remain visible.
const DEFAULT_DURATION_MIN = 60;
// Floor so very short (or end-before-start) events stay tappable.
const MIN_DURATION_MIN = 30;

interface Span {
  occ: Occurrence;
  startMin: number;
  endMin: number;
  col: number;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Position day occurrences on a proportional timeline.
 *
 * Vertical placement is derived from each occurrence's start time and duration,
 * expressed as a percentage of the visible `[rangeStartHour, rangeEndHour)` window.
 * Horizontal placement splits overlapping occurrences into equal-width columns so
 * concurrent events sit side by side (Google-Calendar style).
 */
export function layoutDay(
  occurrences: Occurrence[],
  rangeStartHour: number,
  rangeEndHour: number,
): PositionedOccurrence[] {
  const rangeStart = rangeStartHour * 60;
  const totalRange = (rangeEndHour - rangeStartHour) * 60;
  if (totalRange <= 0 || occurrences.length === 0) return [];

  const spans: Span[] = occurrences
    .map((occ) => {
      const startMin = minutesSinceMidnight(occ.start);
      const rawDuration = occ.end
        ? (occ.end.getTime() - occ.start.getTime()) / 60000
        : DEFAULT_DURATION_MIN;
      const durationMin = Math.max(MIN_DURATION_MIN, rawDuration);
      return { occ, startMin, endMin: startMin + durationMin, col: 0 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  // Walk the sorted spans, breaking them into clusters of transitively
  // overlapping events. Each cluster is laid out independently across the lane.
  const positioned: PositionedOccurrence[] = [];
  let cluster: Span[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    for (const span of cluster) {
      let placed = false;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= span.startMin) {
          span.col = c;
          columnEnds[c] = span.endMin;
          placed = true;
          break;
        }
      }
      if (!placed) {
        span.col = columnEnds.length;
        columnEnds.push(span.endMin);
      }
    }
    const cols = columnEnds.length;
    for (const span of cluster) {
      positioned.push({
        occ: span.occ,
        topPct: ((span.startMin - rangeStart) / totalRange) * 100,
        heightPct: ((span.endMin - span.startMin) / totalRange) * 100,
        leftPct: (span.col / cols) * 100,
        widthPct: (1 / cols) * 100,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const span of spans) {
    if (cluster.length > 0 && span.startMin >= clusterEnd) {
      flush();
    }
    cluster.push(span);
    clusterEnd = Math.max(clusterEnd, span.endMin);
  }
  flush();

  return positioned;
}
