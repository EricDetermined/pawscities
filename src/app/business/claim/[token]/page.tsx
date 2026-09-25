'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// One-click, email-verified claim landing (2026-09-24).
// The business arrives here from a unique link in an email sent to their own
// address. We show the exact listing and a single Confirm button — no search,
// no password. Clicking confirms ownership and activates the listing.

interface TokenInfo {
  valid: boolean;
  reason?: string;
  alreadyClaimed?: boolean;
  claimable?: boolean;
  email?: string;
  businessName?: string;
  establishment?: { id: string; name: string; slug: string; address?: string; city?: string };
}

export default function TokenClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token || '');

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/business/claim-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) setInfo({ valid: false, reason: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const confirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/business/claim-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success || data.alreadyClaimed) {
        setDone(true);
      } else {
        setError(data.reason === 'expired' ? 'This link has expired. Reply to the email and we’ll send a fresh one.'
          : data.reason === 'used' ? 'This link has already been used. Your listing may already be claimed.'
          : 'Something went wrong completing your claim. Please try again or reply to the email.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [token]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-orange-100 p-8">
        <div className="text-3xl mb-4">🐾</div>
        {children}
      </div>
    </div>
  );

  if (loading) return <Shell><p className="text-gray-500">Loading your listing…</p></Shell>;

  if (!info || !info.valid) {
    const msg = info?.reason === 'expired' ? 'This claim link has expired.'
      : info?.reason === 'used' ? 'This claim link has already been used.'
      : 'This claim link is not valid.';
    return (
      <Shell>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-gray-600 mb-6">{msg} You can still claim your listing the standard way.</p>
        <Link href="/business/claim" className="inline-block px-5 py-2.5 bg-orange-600 text-white rounded-lg font-semibold">Claim your listing</Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-gray-900 mb-2">You&rsquo;re all set! 🎉</h1>
        <p className="text-gray-600 mb-4">
          <strong>{info.businessName}</strong> is now yours on Paw Cities and live to visitors. Check your inbox for a quick link to set a password and manage your listing, photos and events.
        </p>
        {info.establishment?.slug && (
          <a href={`/${info.establishment.slug}`} className="text-orange-600 font-medium">View your live listing →</a>
        )}
      </Shell>
    );
  }

  if (info.alreadyClaimed) {
    return (
      <Shell>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Already claimed</h1>
        <p className="text-gray-600 mb-6">This listing has already been claimed. If that wasn&rsquo;t you, reply to the email we sent and we&rsquo;ll help sort it out.</p>
        {info.establishment?.slug && <a href={`/${info.establishment.slug}`} className="text-orange-600 font-medium">View the listing →</a>}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Claim your free listing</h1>
      <p className="text-sm text-gray-500 mb-5">One click — no password needed. This link was sent to your business email, which is all the verification we need.</p>

      <div className="bg-orange-50 rounded-xl p-4 mb-5">
        <div className="font-semibold text-gray-900">{info.establishment?.name}</div>
        {info.establishment?.city && <div className="text-sm text-gray-600">{info.establishment.city}</div>}
        {info.establishment?.address && <div className="text-xs text-gray-400 mt-1">{info.establishment.address}</div>}
      </div>

      <p className="text-sm text-gray-600 mb-5">Confirming as <strong>{info.email}</strong>. You&rsquo;ll be able to edit details, add photos and post events right after.</p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={confirm}
        disabled={submitting}
        className="w-full px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg font-semibold"
      >
        {submitting ? 'Confirming…' : 'Confirm & claim my listing'}
      </button>

      <p className="text-xs text-gray-400 mt-4">Not your business? You can safely ignore this — nothing happens unless you confirm.</p>
    </Shell>
  );
}
