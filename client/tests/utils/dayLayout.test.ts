import { describe, expect, it } from 'vitest';
import type { PostWithAuthor } from '@mayday/shared';
import { layoutDay } from '../../src/utils/dayLayout.js';
import type { Occurrence } from '../../src/utils/recurrence.js';

function makePost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: 'p1',
    type: 'OFFER',
    status: 'OPEN',
    title: 'Event',
    description: '',
    category: 'Food',
    location: null,
    latitude: null,
    longitude: null,
    urgency: 'MEDIUM',
    authorId: 'u1',
    organizationId: null,
    startAt: null,
    endAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    images: [],
    fulfillments: [],
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    author: {
      id: 'u1',
      name: 'Alice',
      bio: null,
      location: null,
      skills: [],
      avatarUrl: null,
      links: null,
      createdAt: '2020-01-01T00:00:00Z',
    },
    organization: null,
    communities: [],
    ...overrides,
  };
}

function occ(
  startHour: number,
  startMin: number,
  durationMin: number | null,
  id = 'p1',
): Occurrence {
  const start = new Date(2026, 3, 20, startHour, startMin, 0, 0);
  const end =
    durationMin === null ? null : new Date(start.getTime() + durationMin * 60000);
  return { post: makePost({ id }), start, end };
}

describe('layoutDay', () => {
  it('returns an empty array for no occurrences', () => {
    expect(layoutDay([], 7, 19)).toEqual([]);
  });

  it('returns an empty array when the range is non-positive', () => {
    expect(layoutDay([occ(9, 0, 60)], 10, 10)).toEqual([]);
  });

  it('positions a single event by start time and duration within the range', () => {
    // 9:00 in a 7..19 (12h = 720min) window. Top = (540-420)/720 = 16.66%.
    const [p] = layoutDay([occ(9, 0, 60)], 7, 19);
    expect(p.topPct).toBeCloseTo((120 / 720) * 100, 5);
    expect(p.heightPct).toBeCloseTo((60 / 720) * 100, 5);
    // A non-overlapping event spans the full lane width.
    expect(p.leftPct).toBe(0);
    expect(p.widthPct).toBe(100);
  });

  it('gives end-less events a default 60-minute height', () => {
    const [p] = layoutDay([occ(9, 0, null)], 7, 19);
    expect(p.heightPct).toBeCloseTo((60 / 720) * 100, 5);
  });

  it('floors very short events to a minimum height so they stay tappable', () => {
    const [p] = layoutDay([occ(9, 0, 5)], 7, 19);
    expect(p.heightPct).toBeCloseTo((30 / 720) * 100, 5);
  });

  it('splits two overlapping events into equal half-width columns', () => {
    const result = layoutDay(
      [occ(9, 0, 120, 'a'), occ(9, 30, 120, 'b')],
      7,
      19,
    );
    expect(result).toHaveLength(2);
    for (const p of result) {
      expect(p.widthPct).toBeCloseTo(50, 5);
    }
    const lefts = result.map((p) => p.leftPct).sort((x, y) => x - y);
    expect(lefts[0]).toBeCloseTo(0, 5);
    expect(lefts[1]).toBeCloseTo(50, 5);
  });

  it('keeps non-overlapping events full width even when both are present', () => {
    const result = layoutDay(
      [occ(9, 0, 60, 'a'), occ(11, 0, 60, 'b')],
      7,
      19,
    );
    for (const p of result) {
      expect(p.widthPct).toBe(100);
      expect(p.leftPct).toBe(0);
    }
  });

  it('reuses a freed column for a later non-overlapping event in the same cluster', () => {
    // a: 9:00-10:00, b: 9:30-11:00 (overlaps a), c: 10:00-11:00 (overlaps b, not a).
    // Max concurrency is 2, so the cluster is 2 columns wide and c reuses a's column.
    const result = layoutDay(
      [occ(9, 0, 60, 'a'), occ(9, 30, 90, 'b'), occ(10, 0, 60, 'c')],
      7,
      19,
    );
    for (const p of result) {
      expect(p.widthPct).toBeCloseTo(50, 5);
    }
    const byId = new Map(result.map((p) => [p.occ.post.id, p]));
    // a and c share column 0; b is in column 1.
    expect(byId.get('a')!.leftPct).toBeCloseTo(0, 5);
    expect(byId.get('c')!.leftPct).toBeCloseTo(0, 5);
    expect(byId.get('b')!.leftPct).toBeCloseTo(50, 5);
  });
});
