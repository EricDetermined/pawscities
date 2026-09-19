'use client';

import { useEffect } from 'react';

// Global error boundary (2026-09-20) — catches crashes in the root layout
// itself, where the normal error.tsx can't render. Must include <html>/<body>.
// Reports directly (can't rely on the layout-mounted reporter here).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        source: 'boundary',
        message: error.message || 'Root layout crash',
        stack: error.stack || null,
        url: typeof location !== 'undefined' ? location.href : null,
      });
      navigator.sendBeacon?.('/api/client-error', new Blob([body], { type: 'application/json' }));
    } catch { /* never throw */ }
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <div>
          <div style={{ fontSize: '3rem' }}>🐾</div>
          <h1 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>Paw Cities hit a snag</h1>
          <p style={{ color: '#555', maxWidth: 420 }}>We&apos;ve been notified and are on it. Please refresh in a moment.</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 16, background: '#ea580c', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none' }}>Back to Paw Cities</a>
        </div>
      </body>
    </html>
  );
}
