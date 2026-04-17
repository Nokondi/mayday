import { addDays, addWeeks, addMonths } from 'date-fns';
import type { PostWithAuthor } from '@mayday/shared';

export interface Occurrence {
  post: PostWithAuthor;
  start: Date;
  end: Date | null;
}

// Hard cap to prevent runaway expansion from bad data.
const MAX_OCCURRENCES = 500;

export function expandOccurrences(
  post: PostWithAuthor,
  windowStart: Date,
  windowEnd: Date,
): Occurrence[] {
  if (!post.startAt) return [];
  const start = new Date(post.startAt);
  const end = post.endAt ? new Date(post.endAt) : null;
  const duration = end ? end.getTime() - start.getTime() : 0;

  if (!post.recurrenceFreq || !post.recurrenceInterval) {
    if (start >= windowStart && start <= windowEnd) {
      return [{ post, start, end }];
    }
    return [];
  }

  const step = (d: Date): Date => {
    if (post.recurrenceFreq === 'DAY') return addDays(d, post.recurrenceInterval!);
    if (post.recurrenceFreq === 'WEEK') return addWeeks(d, post.recurrenceInterval!);
    return addMonths(d, post.recurrenceInterval!);
  };

  const results: Occurrence[] = [];
  let cursor = new Date(start);
  let count = 0;
  while (cursor <= windowEnd && count < MAX_OCCURRENCES) {
    if (cursor >= windowStart) {
      const occEnd = end ? new Date(cursor.getTime() + duration) : null;
      results.push({ post, start: new Date(cursor), end: occEnd });
    }
    cursor = step(cursor);
    count++;
  }
  return results;
}
