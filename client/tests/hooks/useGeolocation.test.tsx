import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../../src/hooks/useGeolocation.js';

const getCurrentPosition = vi.fn();

beforeEach(() => {
  getCurrentPosition.mockReset();
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
});

afterEach(() => {
  // Restore to whatever the environment had (usually undefined under jsdom).
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
});

describe('useGeolocation', () => {
  it('reports the position when the browser resolves successfully', async () => {
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 47.6, longitude: -122.3 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({
      latitude: 47.6,
      longitude: -122.3,
      error: null,
      loading: false,
    });
  });

  it('reports an error message when the browser rejects', async () => {
    getCurrentPosition.mockImplementation((_s: PositionCallback, err: PositionErrorCallback) => {
      err({ message: 'User denied', code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('User denied');
    expect(result.current.latitude).toBeNull();
    expect(result.current.longitude).toBeNull();
  });

  it('reports a friendly error when the browser lacks the geolocation API', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/not supported/i);
  });
});
