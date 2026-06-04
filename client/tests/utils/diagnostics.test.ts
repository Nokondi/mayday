import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDiagnostics, reportClientError } from '../../src/utils/diagnostics.js';

describe('reportClientError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a beacon to /api/client-logs when sendBeacon is available', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    reportClientError({ kind: 'runtime-error', detail: 'boom' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe('/api/client-logs');
    expect(blob).toBeInstanceOf(Blob);

    vi.unstubAllGlobals();
  });

  it('falls back to fetch with keepalive when sendBeacon is missing', () => {
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: undefined });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    reportClientError({ kind: 'runtime-error', detail: 'boom' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client-logs',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );

    vi.unstubAllGlobals();
  });

  it('never throws even if beaconing fails', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      sendBeacon: () => {
        throw new Error('nope');
      },
    });
    expect(() => reportClientError({ kind: 'x' })).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('installDiagnostics', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });
    installDiagnostics();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('beacons uncaught errors surfaced on window', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'unhandled boom' }));
    expect(sendBeacon).toHaveBeenCalledWith('/api/client-logs', expect.any(Blob));
  });
});
