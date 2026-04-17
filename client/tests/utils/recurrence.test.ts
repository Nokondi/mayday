import { describe, expect, it } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';
import { expandOccurrences } from '../../src/utils/recurrence.js';

function makePost(overrides: Partial<PostWithAuthor>): PostWithAuthor {
  return {
    id: 'p1',
    type: 'REQUEST',
    status: 'OPEN',
    title: 'Event',
    description: 'Desc',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    communityId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    author: {
      id: 'u1', name: 'Alice', bio: null, location: null,
      skills: [], avatarUrl: null, createdAt: '2026-04-01T00:00:00Z',
    },
    organization: null,
    community: null,
    ...overrides,
  };
}

// Use UTC timestamps throughout so tests are timezone-independent.
const APRIL_WINDOW_START = new Date('2026-04-01T00:00:00Z');
const APRIL_WINDOW_END = new Date('2026-04-30T23:59:59Z');

describe('expandOccurrences — non-recurring posts', () => {
  it('returns nothing when the post has no startAt', () => {
    const post = makePost({ startAt: null });
    expect(expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END)).toEqual([]);
  });

  it('returns a single occurrence when startAt falls inside the window', () => {
    const post = makePost({ startAt: '2026-04-10T14:00:00Z' });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T14:00:00.000Z');
    expect(result[0].end).toBeNull();
    expect(result[0].post).toBe(post);
  });

  it('returns nothing when startAt is before the window', () => {
    const post = makePost({ startAt: '2026-03-15T14:00:00Z' });
    expect(expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END)).toEqual([]);
  });

  it('returns nothing when startAt is after the window', () => {
    const post = makePost({ startAt: '2026-05-15T14:00:00Z' });
    expect(expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END)).toEqual([]);
  });

  it('preserves the original endAt on a non-recurring occurrence', () => {
    const post = makePost({
      startAt: '2026-04-10T14:00:00Z',
      endAt: '2026-04-10T16:30:00Z',
    });
    const [occ] = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(occ.end?.toISOString()).toBe('2026-04-10T16:30:00.000Z');
  });
});

describe('expandOccurrences — weekly recurrence', () => {
  it('emits one occurrence per week across the window', () => {
    // A Wednesday — should produce 5 Wednesdays in April 2026 (1, 8, 15, 22, 29).
    const post = makePost({
      startAt: '2026-04-01T14:00:00Z',
      recurrenceFreq: 'WEEK',
      recurrenceInterval: 1,
    });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(result.map((o) => o.start.toISOString())).toEqual([
      '2026-04-01T14:00:00.000Z',
      '2026-04-08T14:00:00.000Z',
      '2026-04-15T14:00:00.000Z',
      '2026-04-22T14:00:00.000Z',
      '2026-04-29T14:00:00.000Z',
    ]);
  });

  it('respects an interval greater than 1 (biweekly)', () => {
    const post = makePost({
      startAt: '2026-04-01T14:00:00Z',
      recurrenceFreq: 'WEEK',
      recurrenceInterval: 2,
    });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(result.map((o) => o.start.toISOString())).toEqual([
      '2026-04-01T14:00:00.000Z',
      '2026-04-15T14:00:00.000Z',
      '2026-04-29T14:00:00.000Z',
    ]);
  });

  it('expands occurrences whose first startAt is before the window', () => {
    // Start Mar 25 (post-DST in US timezones), so walking weeks into April
    // stays in a single DST regime and UTC hours are preserved by date-fns.
    const post = makePost({
      startAt: '2026-03-25T14:00:00Z',
      recurrenceFreq: 'WEEK',
      recurrenceInterval: 1,
    });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(result.map((o) => o.start.toISOString())).toEqual([
      '2026-04-01T14:00:00.000Z',
      '2026-04-08T14:00:00.000Z',
      '2026-04-15T14:00:00.000Z',
      '2026-04-22T14:00:00.000Z',
      '2026-04-29T14:00:00.000Z',
    ]);
  });

  it('preserves the duration on each recurring occurrence', () => {
    const post = makePost({
      startAt: '2026-04-01T14:00:00Z',
      endAt: '2026-04-01T16:30:00Z',
      recurrenceFreq: 'WEEK',
      recurrenceInterval: 1,
    });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    // Each occurrence should be 2.5 hours long.
    for (const occ of result) {
      expect(occ.end).not.toBeNull();
      expect(occ.end!.getTime() - occ.start.getTime()).toBe(2.5 * 60 * 60 * 1000);
    }
  });
});

describe('expandOccurrences — daily and monthly recurrence', () => {
  it('expands daily recurrence with interval 2', () => {
    const post = makePost({
      startAt: '2026-04-01T12:00:00Z',
      recurrenceFreq: 'DAY',
      recurrenceInterval: 2,
    });
    const result = expandOccurrences(
      post,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-07T23:59:59Z'),
    );
    // April 1, 3, 5, 7
    expect(result.map((o) => o.start.toISOString())).toEqual([
      '2026-04-01T12:00:00.000Z',
      '2026-04-03T12:00:00.000Z',
      '2026-04-05T12:00:00.000Z',
      '2026-04-07T12:00:00.000Z',
    ]);
  });

  it('expands monthly recurrence', () => {
    // Pick a window that stays inside US DST (Mar–Oct) so date-fns's local-time
    // addMonths behavior doesn't shift the UTC hour across a DST boundary.
    const post = makePost({
      startAt: '2026-05-15T12:00:00Z',
      recurrenceFreq: 'MONTH',
      recurrenceInterval: 1,
    });
    const result = expandOccurrences(
      post,
      new Date('2026-05-01T00:00:00Z'),
      new Date('2026-10-31T23:59:59Z'),
    );
    expect(result.map((o) => o.start.toISOString())).toEqual([
      '2026-05-15T12:00:00.000Z',
      '2026-06-15T12:00:00.000Z',
      '2026-07-15T12:00:00.000Z',
      '2026-08-15T12:00:00.000Z',
      '2026-09-15T12:00:00.000Z',
      '2026-10-15T12:00:00.000Z',
    ]);
  });

  it('falls back to a single occurrence when only one of freq/interval is set', () => {
    const post = makePost({
      startAt: '2026-04-10T14:00:00Z',
      recurrenceFreq: 'WEEK',
      recurrenceInterval: null, // malformed data — treat as non-recurring
    });
    const result = expandOccurrences(post, APRIL_WINDOW_START, APRIL_WINDOW_END);
    expect(result).toHaveLength(1);
  });
});
