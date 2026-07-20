'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StatsResponse {
  ambassador: {
    name: string;
    city: string;
    citySlug: string | null;
    status: string;
    tier: string | null;
    referralCode?: string;
    shareUrl?: string;
  } | null;
  stats?: {
    members: number;
    subscribers: number;
    businessClaims: number;
    businessesLive: number;
  };
}

const TIER_LABELS: Record<string, string> = {
  explorer: 'Explorer',
  trailblazer: 'Trailblazer',
  pack_leader: 'Pack Leader',
};

export function AmbassadorDashboardClient() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/ambassadors/stats')
      .then(res => {
        if (res.status === 401) {
          setAuthed(false);
          return null;
        }
        return res.json();
      })
      .then(d => d && setData(d))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    if (!data?.ambassador?.shareUrl) return;
    navigator.clipboard.writeText(data.ambassador.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl block mb-4">🐾</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to see your ambassador dashboard</h1>
          <Link
            href="/login?redirect=/ambassadors/dashboard"
            className="inline-block mt-4 px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!data?.ambassador) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <span className="text-5xl block mb-4">🌟</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Become a Paw Cities Ambassador</h1>
          <p className="text-gray-500 mb-6">
            No ambassador profile is linked to this account yet. Apply to represent your city —
            explore dog-friendly spots, grow the local pack, and earn rewards.
          </p>
          <Link
            href="/ambassadors"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600"
          >
            Learn more & apply
          </Link>
        </div>
      </div>
    );
  }

  const { ambassador, stats } = data;

  if (ambassador.status !== 'approved' || !ambassador.shareUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <span className="text-5xl block mb-4">⏳</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Application {ambassador.status === 'pending' ? 'under review' : ambassador.status}
          </h1>
          <p className="text-gray-500">
            Thanks for applying, {ambassador.name.split(' ')[0]}! Your dashboard unlocks as soon as
            your application for {ambassador.city} is approved.
          </p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Members joined', value: stats?.members ?? 0, emoji: '🐶' },
    { label: 'Newsletter subscribers', value: stats?.subscribers ?? 0, emoji: '💌' },
    { label: 'Business claims', value: stats?.businessClaims ?? 0, emoji: '🏪' },
    { label: 'Businesses live', value: stats?.businessesLive ?? 0, emoji: '✅' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-orange-100 text-sm font-medium">
            {TIER_LABELS[ambassador.tier || ''] || 'Ambassador'} · {ambassador.city}
          </p>
          <h1 className="text-3xl font-bold mt-1">Welcome back, {ambassador.name.split(' ')[0]} 🌟</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Share link */}
        <div className="bg-white rounded-2xl border border-orange-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-1">Your referral link</h2>
          <p className="text-sm text-gray-500 mb-4">
            Every signup, subscriber, and business claim through this link is credited to you.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 overflow-x-auto whitespace-nowrap">
              {ambassador.shareUrl}
            </code>
            <button
              onClick={copyLink}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                copied ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Referral code: <span className="font-mono">{ambassador.referralCode}</span> — works on
            any pawcities.com URL by adding <span className="font-mono">?ref={ambassador.referralCode}</span>
          </p>
        </div>

        {/* Impact */}
        <h2 className="font-semibold text-gray-900 mb-4">Your impact</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <span className="text-2xl block mb-1">{card.emoji}</span>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Playbook */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Grow {ambassador.city}&apos;s pack</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>🐶 <strong>Dog owners:</strong> share your link — after signup they add their dog and appear in the{' '}
              {ambassador.citySlug ? (
                <Link href={`/dogs?city=${ambassador.citySlug}`} className="text-orange-600 hover:underline">
                  {ambassador.city} directory
                </Link>
              ) : 'city directory'}.
            </p>
            <p>🏪 <strong>Businesses:</strong> cafes and groomers can claim their listing at{' '}
              <span className="font-mono text-xs">pawcities.com/business/claim?ref={ambassador.referralCode}</span>{' '}
              — claims through your code are credited to you.
            </p>
            <p>📅 <strong>Events:</strong> anyone can submit at{' '}
              <Link href="/events/submit" className="text-orange-600 hover:underline">pawcities.com/events/submit</Link>{' '}
              — approved events appear on the city page and in the weekly digest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
