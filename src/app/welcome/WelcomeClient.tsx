'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProfileData {
  user: { name: string | null; home_city: string | null };
  stats: { dogs: number };
}

export function WelcomeClient() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [cities, setCities] = useState<{ slug: string; name: string }[]>([]);
  const [city, setCity] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  const [citySaved, setCitySaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then(r => (r.ok ? r.json() : null)),
      fetch('/api/cities').then(r => r.json()),
    ])
      .then(([prof, cityData]) => {
        if (prof?.user) {
          setProfile(prof);
          if (prof.user.home_city) {
            setCity(prof.user.home_city);
            setCitySaved(true);
          }
        }
        setCities(cityData.cities || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveCity = async (slug: string) => {
    setCity(slug);
    if (!slug) return;
    setSavingCity(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCity: slug }),
      });
      if (res.ok) setCitySaved(true);
    } finally {
      setSavingCity(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center text-gray-500">
        Setting things up...
      </div>
    );
  }

  const firstName = profile?.user?.name?.split(' ')[0] || 'there';
  const hasDog = (profile?.stats?.dogs || 0) > 0;
  const cityName = cities.find(c => c.slug === city)?.name;

  const steps = [
    {
      done: citySaved,
      emoji: '📍',
      title: 'Pick your city',
      body: (
        <div className="flex items-center gap-3">
          <select
            value={city}
            onChange={e => saveCity(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
          >
            <option value="">Choose your city...</option>
            {cities.map(c => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          {savingCity && <span className="text-sm text-gray-400">Saving...</span>}
          {citySaved && !savingCity && <span className="text-sm text-emerald-600">✓ Saved</span>}
        </div>
      ),
    },
    {
      done: hasDog,
      emoji: '🐶',
      title: 'Add your dog',
      body: (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Photos, breed, personality — and flip on &quot;Show on Paw Cities&quot; so
            {cityName ? ` ${cityName}` : ' local'} dog owners can find you.
          </p>
          <Link
            href="/profile/dogs/new"
            className="inline-block px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            {hasDog ? '✓ Dog added — add another?' : 'Add my dog'}
          </Link>
        </div>
      ),
    },
    {
      done: false,
      emoji: '🐾',
      title: 'Meet the pack',
      body: (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Follow a few local dogs — their check-ins and reviews show up in your feed.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={city ? `/dogs?city=${city}` : '/dogs'}
              className="inline-block px-5 py-2.5 border border-orange-300 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-50 transition-colors"
            >
              Browse {cityName ? `${cityName} dogs` : 'dogs'}
            </Link>
            {city && (
              <Link
                href={`/${city}`}
                className="inline-block px-5 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Explore {cityName}
              </Link>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-5xl block mb-3">🎉</span>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {firstName}!</h1>
          <p className="text-gray-600 mt-2">
            Two minutes of setup and you&apos;re part of the pack.
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border p-5 ${
                step.done ? 'border-emerald-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${
                    step.done ? 'bg-emerald-100' : 'bg-orange-100'
                  }`}
                >
                  {step.done ? '✓' : step.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 mb-2">
                    {i + 1}. {step.title}
                  </h2>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href={city ? `/${city}` : '/'} className="text-sm text-gray-400 hover:text-gray-600">
            Skip for now — take me to the site →
          </Link>
        </div>
      </div>
    </div>
  );
}
