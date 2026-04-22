import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from '../../src/hooks/useDebounce.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('does not update during the delay window', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current).toBe('a');
  });

  it('updates once the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('b');
  });

  it('resets the timer when the value changes again before it fires', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: 'a' },
    });

    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(400); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(400); });
    // 800ms have passed since the first change, but only 400ms since the latest value.
    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });
});
