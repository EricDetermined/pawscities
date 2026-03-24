'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

interface Suggestion {
  id: string;
  city_name: string;
  country: string;
  state_region: string;
  vote_count: number;
  status: string;
}

export default function SuggestCityPage() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [cityName, setCityName] = useState('');
  const [country, setCountry] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [honeypot, setHoneypot] = useState(''); // bot trap

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/city-suggestions');
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setUserVotes(data.userVotes || []);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to suggest a city.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/city-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          cityName,
          country,
          stateRegion,
          website: honeypot, // honeypot field
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setCityName('');
        setCountry('');
        setStateRegion('');
        fetchSuggestions();
      } else {
        setMessage({ type: 'error', text: data.error || 'Something went wrong.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, isUnvote: boolean) => {
    if (!user) {
      setMessage({ type: 'error', text: 'Please log in to vote.' });
      return;
    }
    setVotingId(suggestionId);

    try {
      const res = await fetch('/api/city-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isUnvote ? 'unvote' : 'vote',
          suggestionId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        fetchSuggestions();
      } else {
        setMessage({ type: 'error', text: data.error || 'Vote failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setVotingId(null);
    }
  };

  const getRankEmoji = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Where Should Paw Cities Go Next?
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Help us decide which city to launch next. Suggest a city or vote for one already on the list.
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4 py-10">
        {/* Suggest Form */}
        <div className="bg-white rounded-xl border p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Suggest a New City</h2>

          {!user && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-orange-800">
                <Link href="/login?redirect=/suggest-city" className="font-semibold underline">Log in</Link> or <Link href="/signup?redirect=/suggest-city" className="font-semibold underline">sign up</Link> to suggest and vote for cities. It takes 30 seconds!
              </p>
            </div>
          )}

          <form onSubmit={handleSuggest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City Name *</label>
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="e.g., Austin"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={!user}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g., United States"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={!user}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State / Region <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={stateRegion}
                onChange={(e) => setStateRegion(e.target.value)}
                placeholder="e.g., Texas"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                maxLength={100}
                disabled={!user}
              />
            </div>

            {/* Honeypot - hidden from real users */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label>Website</label>
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={!user || submitting}
              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Suggest This City'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Most Requested Cities</h2>
            <span className="text-sm text-gray-500">{suggestions.length} {suggestions.length === 1 ? 'city' : 'cities'} suggested</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🌍</div>
              <p className="text-gray-600 font-medium mb-1">No suggestions yet!</p>
              <p className="text-sm text-gray-500">Be the first to suggest a city for Paw Cities to expand to.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const hasVoted = userVotes.includes(s.id);
                const isVoting = votingId === s.id;

                return (
                  <div key={s.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    {/* Rank */}
                    <div className="shrink-0 w-10 text-center">
                      <span className={`text-lg ${i < 3 ? '' : 'text-sm text-gray-400'}`}>
                        {getRankEmoji(i)}
                      </span>
                    </div>

                    {/* City info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {s.city_name}
                        {s.state_region && <span className="text-gray-500">, {s.state_region}</span>}
                      </p>
                      <p className="text-xs text-gray-500">{s.country}</p>
                    </div>

                    {/* Vote count */}
                    <div className="shrink-0 text-center mr-2">
                      <p className="text-lg font-bold text-gray-900">{s.vote_count}</p>
                      <p className="text-xs text-gray-400">{s.vote_count === 1 ? 'vote' : 'votes'}</p>
                    </div>

                    {/* Vote button */}
                    <button
                      onClick={() => handleVote(s.id, hasVoted)}
                      disabled={!user || isVoting}
                      className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        hasVoted
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                      }`}
                      title={!user ? 'Log in to vote' : hasVoted ? 'Remove vote' : 'Vote for this city'}
                    >
                      {isVoting ? '...' : hasVoted ? '✓ Voted' : '▲ Vote'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Share prompt */}
        <div className="mt-8 bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
          <p className="font-semibold text-gray-900 mb-1">Rally your city!</p>
          <p className="text-sm text-gray-600">Share this page with fellow dog owners in your city to move it up the leaderboard.</p>
        </div>
      </div>
    </div>
  );
}
