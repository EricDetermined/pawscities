'use client';

import { useState } from 'react';

interface NewsletterSignupProps {
  /** Pre-select a city (e.g., on city pages) */
  citySlug?: string;
  /** Where the signup came from, for attribution */
  source?: string;
  /** Visual variant */
  variant?: 'hero' | 'inline' | 'footer' | 'banner';
  /** Custom heading */
  heading?: string;
  /** Custom subtext */
  subtext?: string;
}

export default function NewsletterSignup({
  citySlug,
  source = 'website',
  variant = 'inline',
  heading,
  subtext,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;

    setStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), citySlug, source }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setMessage(data.alreadySubscribed ? 'You\'re already on the list!' : 'You\'re in! Check your inbox soon.');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  const defaultHeading = 'Get the Best Dog-Friendly Spots Weekly';
  const defaultSubtext = 'Events, new places, and dog tips — delivered to your inbox every week. Join dog lovers across 8 cities.';

  const h = heading || defaultHeading;
  const sub = subtext || defaultSubtext;

  // ─── Hero variant: dark bg, larger, used on homepage ──────────────────
  if (variant === 'hero') {
    return (
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] rounded-2xl p-8 sm:p-10">
        <div className="max-w-xl">
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{h}</h3>
          <p className="text-white/70 text-sm mb-5">{sub}</p>
          {status === 'success' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                placeholder="your@email.com"
                required
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/25 text-white placeholder-white/40 focus:bg-white/15 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all text-sm"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors text-sm whitespace-nowrap"
              >
                {status === 'loading' ? 'Joining...' : 'Join Free'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-xs mt-2">{message}</p>
          )}
          <p className="text-white/40 text-xs mt-3">No spam, ever. Unsubscribe anytime.</p>
        </div>
      </div>
    );
  }

  // ─── Banner variant: full-width colored strip ─────────────────────────
  if (variant === 'banner') {
    return (
      <section className="bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white md:max-w-md">
              <h3 className="text-xl sm:text-2xl font-bold mb-1">{h}</h3>
              <p className="text-white/90 text-sm">{sub}</p>
            </div>
            {status === 'success' ? (
              <div className="flex items-center gap-2 text-white font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {message}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
                  placeholder="your@email.com"
                  required
                  className="flex-1 md:w-64 px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-white/60 focus:bg-white/30 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors text-sm whitespace-nowrap"
                >
                  {status === 'loading' ? 'Joining...' : 'Subscribe'}
                </button>
              </form>
            )}
          </div>
          {status === 'error' && (
            <p className="text-white/80 text-xs mt-2 text-center md:text-right">{message}</p>
          )}
        </div>
      </section>
    );
  }

  // ─── Footer variant: minimal, dark-friendly ───────────────────────────
  if (variant === 'footer') {
    return (
      <div className="max-w-sm">
        <h4 className="text-white font-semibold text-sm mb-2">Weekly Dog-Friendly Digest</h4>
        <p className="text-gray-400 text-xs mb-3">Events, tips, and new spots in your city.</p>
        {status === 'success' ? (
          <p className="text-green-400 text-xs font-medium">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
              placeholder="your@email.com"
              required
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none text-xs"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-lg font-medium transition-colors text-xs whitespace-nowrap"
            >
              {status === 'loading' ? '...' : 'Join'}
            </button>
          </form>
        )}
        {status === 'error' && <p className="text-red-400 text-xs mt-1">{message}</p>}
      </div>
    );
  }

  // ─── Inline variant (default): white card ─────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-1">{h}</h3>
          <p className="text-gray-500 text-sm">{sub}</p>
        </div>
        {status === 'success' ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium whitespace-nowrap">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
              placeholder="your@email.com"
              required
              className="flex-1 sm:w-56 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 text-sm"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-semibold transition-colors text-sm whitespace-nowrap"
            >
              {status === 'loading' ? 'Joining...' : 'Join Free'}
            </button>
          </form>
        )}
      </div>
      {status === 'error' && <p className="text-red-500 text-xs mt-2">{message}</p>}
    </div>
  );
}
