'use client';

import { useEffect } from 'react';

/**
 * Global browser-error reporter (2026-09-20). Mounts once in the root layout,
 * listens for uncaught errors and unhandled promise rejections, and POSTs a
 * compact record to /api/client-error. Deliberately silent and best-effort —
 * it must never interfere with the page or loop on its own failures.
 */
function report(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ ...payload, url: typeof location !== 'undefined' ? location.href : null });
    // sendBeacon survives page unload and doesn't block; fall back to fetch.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* never throw from the reporter */ }
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => report({
      source: 'window',
      message: e.message || 'Unknown error',
      stack: e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`,
    });
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report({
        source: 'promise',
        message: (r && (r.message || String(r))) || 'Unhandled promise rejection',
        stack: r?.stack || null,
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

// Shared helper for React error boundaries to report crashes.
export function reportBoundaryError(error: Error) {
  report({ source: 'boundary', message: error.message || 'React render error', stack: error.stack || null });
}
