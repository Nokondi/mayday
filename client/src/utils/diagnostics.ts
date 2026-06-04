// Client-side error beacons. These post to /api/client-logs so boot/runtime
// failures that users never report (and that are hard to reproduce on a
// specific phone) show up in the server logs. The endpoint is unauthenticated
// because the most important failures happen before the user is logged in.
//
// Note: index.html installs its own pre-bundle watchdog and beacons for the
// "bundle never loaded" case. This module covers failures that happen *after*
// the bundle is running (uncaught errors, rejected promises, React crashes).

interface ClientLogPayload {
  kind: string;
  detail?: string;
}

export function reportClientError({ kind, detail }: ClientLogPayload): void {
  try {
    const body = JSON.stringify({
      kind,
      detail: String(detail ?? '').slice(0, 2000),
      url: location.href,
      userAgent: navigator.userAgent,
      standalone:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/client-logs',
        new Blob([body], { type: 'application/json' }),
      );
    } else {
      void fetch('/api/client-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Diagnostics must never throw and never block the app.
  }
}

// Installs global handlers for errors that escape React's render tree (e.g.
// inside event handlers, timers, or async code). Call once at startup.
export function installDiagnostics(): void {
  window.addEventListener('error', (event) => {
    if (event.message) {
      reportClientError({ kind: 'runtime-error', detail: event.message });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | undefined;
    reportClientError({
      kind: 'unhandled-rejection',
      detail: reason?.message ?? String(event.reason),
    });
  });
}
