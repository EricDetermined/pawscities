'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const CITIES = [
  'Geneva', 'Paris', 'London', 'Los Angeles', 'New York',
  'Barcelona', 'Sydney', 'Tokyo',
];

const TIERS = [
  {
    name: 'Explorer',
    time: '3–5 hrs/month',
    color: 'from-amber-50 to-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    tasks: [
      'Share dog-friendly discoveries on Instagram',
      'Write honest place reviews',
      'Photograph local dog-friendly events',
      'Provide platform feedback',
    ],
    perks: [
      'Official Ambassador badge',
      'Branded welcome kit',
      'Early access to new features',
      'Ambassador community access',
    ],
    term: 'Rolling (month-to-month)',
  },
  {
    name: 'Trailblazer',
    time: '8–12 hrs/month',
    color: 'from-blue-50 to-indigo-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    highlight: true,
    tasks: [
      'Convert local businesses to paid subscriptions',
      'Submit events to the city calendar',
      'Host monthly dog owner meetups',
      'Create original content monthly',
    ],
    perks: [
      'Everything in Explorer, plus:',
      '20% commission (first 3 months)',
      '10% ongoing revenue share',
      'Event access & networking',
    ],
    term: '3-month minimum',
  },
  {
    name: 'Pack Leader',
    time: '15–20 hrs/month',
    color: 'from-purple-50 to-indigo-50',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    tasks: [
      'Lead your city\'s ambassador team',
      'Recruit & mentor new Explorers',
      'Coordinate city strategy with HQ',
      'Represent Paw Cities at local events',
    ],
    perks: [
      'Everything in Trailblazer, plus:',
      'Monthly stipend (€100–200)',
      'Strategy input with headquarters',
      'Annual ambassador retreat',
    ],
    term: '6-month minimum (by invitation)',
  },
];

const STEPS = [
  { num: '1', title: 'Apply', desc: 'Fill out the form below with your city, Instagram, and why you want to join.', color: 'bg-orange-600' },
  { num: '2', title: 'Interview', desc: 'Quick video call so we can get to know each other (Trailblazer+ only).', color: 'bg-blue-600' },
  { num: '3', title: 'Onboard', desc: 'Accept the agreement, receive your welcome kit, and join the community.', color: 'bg-green-600' },
  { num: '4', title: 'Explore', desc: 'Start as an Explorer and level up as you grow your impact.', color: 'bg-purple-600' },
];

// ─── Agreement Text ────────────────────────────────────────────────
const AGREEMENT_TEXT = `PAW CITIES AMBASSADOR AGREEMENT (v1.0)

By accepting this agreement, you agree to the following terms:

1. PURPOSE: You will represent and promote Paw Cities within your designated city by creating content, building community relationships, and participating in program activities.

2. RELATIONSHIP: You are an independent contractor, not an employee. You set your own schedule and use your own equipment. You are free to work with non-competing brands.

3. COMPENSATION: Rewards are limited to the program's published incentive structure, including commission on paid business subscriptions referred through your unique link. Reward structures may be modified with 30 days' notice.

4. INTELLECTUAL PROPERTY: Content you create remains yours. You grant Paw Cities a perpetual, non-exclusive license to use, repost, and adapt your content for marketing purposes with credit. You may revoke this license for specific content with 30 days' written notice.

5. CONFIDENTIALITY: You agree not to disclose internal metrics, unreleased features, business strategies, other ambassadors' personal information, or proprietary tools and processes. This obligation survives termination for 2 years.

6. BRAND REPRESENTATION: You will represent Paw Cities consistently with our brand guidelines, will not make false claims, and will include #PawCitiesAmbassador disclosure on ambassador-related content per local advertising laws.

7. NON-COMPETE: During your term, you agree not to serve as ambassador for any directly competing dog-friendly place discovery platform.

8. TERMINATION: Either party may terminate with 14 days' written notice. Immediate termination is reserved for serious violations including brand-damaging conduct, confidentiality breaches, or illegal activity.

9. DATA PROTECTION: Both parties will handle personal data in accordance with applicable laws (GDPR, CCPA, etc.).

This agreement is governed by applicable local law. By clicking "I Accept," you confirm you have read, understood, and agree to these terms.`;

interface InviteData {
  code: string;
  city?: string | null;
  tier?: string | null;
  recipientName?: string | null;
}

export default function AmbassadorPageClient() {
  const searchParams = useSearchParams();

  // Invite gate state
  const [inviteVerified, setInviteVerified] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteChecking, setInviteChecking] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    instagramHandle: '',
    city: '',
    whyJoin: '',
    howExplore: '',
    availability: 'explorer',
    followerCount: '',
  });

  // Check for invite code in URL on mount
  useEffect(() => {
    const codeFromUrl = searchParams.get('invite') || searchParams.get('code');
    if (codeFromUrl) {
      verifyInvite(codeFromUrl);
    }
  }, [searchParams]);

  const verifyInvite = async (code: string) => {
    setInviteChecking(true);
    setInviteError('');

    try {
      const res = await fetch('/api/ambassadors/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.valid) {
        setInviteVerified(true);
        setInviteData(data.invite);
        // Pre-fill city if the invite has one
        if (data.invite.city) {
          setForm(prev => ({ ...prev, city: data.invite.city }));
        }
        if (data.invite.tier) {
          setForm(prev => ({ ...prev, availability: data.invite.tier }));
        }
      } else {
        setInviteError(data.error || 'Invalid invite code');
      }
    } catch {
      setInviteError('Could not verify invite code. Please try again.');
    } finally {
      setInviteChecking(false);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteInput.trim()) {
      verifyInvite(inviteInput.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('Please accept the Ambassador Agreement to continue.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/ambassadors/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          agreementAccepted: agreedToTerms,
          inviteCode: inviteData?.code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Invite Gate Screen ──────────────────────────────────
  if (!inviteVerified) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <img
            src="/ambassador-badge.svg"
            alt="Paw Cities Ambassador"
            width={120}
            height={120}
            className="mx-auto mb-8 drop-shadow-md"
          />
          <h1 className="font-display text-3xl font-bold text-gray-900 mb-3">
            Ambassador Program
          </h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            The Paw Cities Ambassador Program is invite-only. If you&apos;ve received an invite code, enter it below to access your application.
          </p>

          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => {
                setInviteInput(e.target.value.toUpperCase());
                setInviteError('');
              }}
              placeholder="Enter your invite code"
              className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none uppercase"
              maxLength={20}
              autoFocus
            />
            {inviteError && (
              <p className="text-red-600 text-sm">{inviteError}</p>
            )}
            <button
              type="submit"
              disabled={inviteChecking || !inviteInput.trim()}
              className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteChecking ? 'Verifying...' : 'Continue'}
            </button>
          </form>

          <p className="mt-8 text-sm text-gray-400">
            Don&apos;t have an invite? Follow{' '}
            <a href="https://instagram.com/thepawcities" target="_blank" rel="noopener noreferrer" className="text-orange-600 font-medium hover:underline">
              @thepawcities
            </a>{' '}
            for future opportunities.
          </p>
        </div>
      </div>
    );
  }

  // ─── Full Ambassador Page (invite verified) ──────────────
  return (
    <div className="min-h-screen bg-white">

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-24 px-4">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto max-w-5xl relative">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img
                src="/ambassador-badge.svg"
                alt="Paw Cities Ambassador Badge"
                width={100}
                height={100}
                className="drop-shadow-lg"
              />
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Become a Paw Cities<br />Ambassador
            </h1>
            <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto mb-10 leading-relaxed">
              Love your city? Love dogs? Join our team of local ambassadors and help build the ultimate dog-friendly community — while earning real rewards.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  setShowForm(true);
                  setTimeout(() => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' }), 100);
                }}
                className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg"
              >
                Apply Now
              </button>
              <a
                href="#tiers"
                className="px-8 py-4 border-2 border-white/30 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
              >
                View Tiers
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ────────────────────────────────────────── */}
      <section className="bg-gray-900 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-bold">8</p>
              <p className="text-sm text-gray-400">Cities Worldwide</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">3</p>
              <p className="text-sm text-gray-400">Ambassador Tiers</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">25%</p>
              <p className="text-sm text-gray-400">Max Commission</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold">Free</p>
              <p className="text-sm text-gray-400">To Join</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why Join ─────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Become an Ambassador?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Turn your passion for dogs and your city into something meaningful
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 border border-orange-100">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center text-2xl mb-5">
                <span role="img" aria-label="money">💰</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Earn Real Rewards</h3>
              <p className="text-gray-600 leading-relaxed">
                Earn commission on every business you bring to Paw Cities as a paid subscriber. 20% for the first 3 months, then 10% ongoing revenue share.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-5">
                <span role="img" aria-label="community">🐕</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Build Community</h3>
              <p className="text-gray-600 leading-relaxed">
                Host meetups, discover hidden gems, and connect with fellow dog owners in your city. Shape the local dog-friendly scene.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-5">
                <span role="img" aria-label="globe">🌍</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Global Network</h3>
              <p className="text-gray-600 leading-relaxed">
                Join ambassadors across 8 cities worldwide. Network, collaborate, and shape the future of Paw Cities alongside the founding team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tiers ────────────────────────────────────────────── */}
      <section id="tiers" className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Three Tiers, One Community
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start as an Explorer and grow your impact at your own pace
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`bg-gradient-to-br ${tier.color} rounded-2xl p-6 border-2 ${
                  tier.highlight ? 'border-blue-400 ring-2 ring-blue-200' : tier.border
                } relative`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="text-center mb-4">
                  <span className={`inline-block px-3 py-1 ${tier.badge} rounded-full text-sm font-bold`}>
                    {tier.name}
                  </span>
                  <p className="text-sm text-gray-500 mt-2">{tier.time}</p>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">What you do</h4>
                  <ul className="space-y-1.5">
                    {tier.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-orange-500 mt-0.5 shrink-0">&#x2713;</span>
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">What you get</h4>
                  <ul className="space-y-1.5">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className={`flex items-start gap-2 text-sm ${i === 0 && tier.name !== 'Explorer' ? 'text-gray-500 italic' : 'text-gray-700'}`}>
                        {i === 0 && tier.name !== 'Explorer' ? '' : <span className="text-green-500 mt-0.5 shrink-0">&#x2713;</span>}
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-gray-200/50 text-center">
                  <p className="text-xs text-gray-500">{tier.term}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">Four steps to becoming an ambassador</p>
          </div>
          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.num} className="flex items-start gap-6 bg-white rounded-xl p-6 border shadow-sm">
                <div className={`w-12 h-12 ${step.color} text-white rounded-xl flex items-center justify-center text-xl font-bold shrink-0`}>
                  {step.num}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Badge Preview ────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-2xl border shadow-sm p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0">
              <img
                src="/ambassador-badge.svg"
                alt="Paw Cities Ambassador Badge"
                width={160}
                height={160}
                className="drop-shadow-md"
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Your Ambassador Badge</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Every ambassador gets an official Paw Cities Ambassador badge. It appears on your profile, your reviews, and your comments across the platform. You also get a downloadable version for your Instagram bio and highlights.
              </p>
              <p className="text-sm text-gray-500">
                Badge shown on all reviews and comments you make on Paw Cities, marking you as a trusted community voice.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Application Form ─────────────────────────────────── */}
      <section id="apply" className="py-20 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ready to Join the Pack?
            </h2>
            <p className="text-lg text-gray-600">
              Fill out the form below and we&apos;ll get back to you within 5 business days.
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">
                <span role="img" aria-label="celebration">🎉</span>
              </div>
              <h3 className="text-2xl font-bold text-green-800 mb-3">Application Submitted!</h3>
              <p className="text-green-700 leading-relaxed">
                Thank you for applying to become a Paw Cities Ambassador. We&apos;ll review your application and get back to you within 5 business days. In the meantime, follow us on{' '}
                <a href="https://instagram.com/thepawcities" target="_blank" rel="noopener noreferrer" className="font-bold underline">
                  @thepawcities
                </a>{' '}
                and start tagging #PawCities in your posts!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border shadow-sm p-8 space-y-6">

              {/* Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Instagram & City */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instagram Handle</label>
                  <input
                    type="text"
                    value={form.instagramHandle}
                    onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="@yourusername"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your City *</label>
                  <select
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Select your city</option>
                    {CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tier & Followers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">I&apos;m interested in *</label>
                  <select
                    required
                    value={form.availability}
                    onChange={(e) => setForm({ ...form, availability: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="explorer">Explorer (3–5 hrs/month)</option>
                    <option value="trailblazer">Trailblazer (8–12 hrs/month)</option>
                    <option value="pack_leader">Pack Leader (15–20 hrs/month)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instagram Followers</label>
                  <select
                    value={form.followerCount}
                    onChange={(e) => setForm({ ...form, followerCount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="<500">Under 500</option>
                    <option value="500-2k">500 – 2,000</option>
                    <option value="2k-10k">2,000 – 10,000</option>
                    <option value="10k+">10,000+</option>
                  </select>
                </div>
              </div>

              {/* Why Join */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Why do you want to be an ambassador? *</label>
                <textarea
                  required
                  rows={3}
                  value={form.whyJoin}
                  onChange={(e) => setForm({ ...form, whyJoin: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                  placeholder="Tell us what excites you about the program..."
                />
              </div>

              {/* How they explore */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">How do you explore your city with your dog? *</label>
                <textarea
                  required
                  rows={3}
                  value={form.howExplore}
                  onChange={(e) => setForm({ ...form, howExplore: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                  placeholder="Favorite spots, weekend routines, dog meetups you attend..."
                />
              </div>

              {/* Agreement */}
              <div className="bg-gray-50 rounded-xl p-5 border">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900">Ambassador Agreement</h4>
                  <button
                    type="button"
                    onClick={() => setShowAgreement(!showAgreement)}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    {showAgreement ? 'Hide' : 'Read full agreement'}
                  </button>
                </div>
                {showAgreement && (
                  <div className="mb-4 max-h-64 overflow-y-auto bg-white rounded-lg border p-4 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {AGREEMENT_TEXT}
                  </div>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (e.target.checked) setError('');
                    }}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and accept the{' '}
                    <button
                      type="button"
                      onClick={() => setShowAgreement(true)}
                      className="text-orange-600 underline font-medium"
                    >
                      Paw Cities Ambassador Agreement
                    </button>{' '}
                    (v1.0)
                  </span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Questions? Email us at{' '}
                <a href="mailto:eric@pawcities.com" className="text-orange-600 font-medium">
                  eric@pawcities.com
                </a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Do I need a lot of Instagram followers?',
                a: 'No! Explorers have no follower minimum. We care more about your passion for dogs and your city than your follower count.',
              },
              {
                q: 'How do I earn commission?',
                a: 'You get a unique referral link. When a business subscribes to a paid Paw Cities plan through your link, you earn 20% of the first 3 months\' revenue, then 10% ongoing as long as they stay subscribed.',
              },
              {
                q: 'Can I be an ambassador in a city not listed?',
                a: 'We\'re focused on our 8 launch cities for now, but we\'re always looking to expand. Apply with your city and we\'ll keep you in mind!',
              },
              {
                q: 'What\'s the time commitment?',
                a: 'Explorers contribute 3–5 hours per month — about an hour a week. It\'s designed to fit around your normal dog walks and city explorations.',
              },
              {
                q: 'Is there a contract?',
                a: 'Yes, a simple agreement covering confidentiality, brand guidelines, and terms. Explorers can leave month-to-month with 14 days\' notice.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border p-5">
                <h3 className="text-base font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Join the Pack
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Help shape the dog-friendly future of your city.
          </p>
          <button
            onClick={() => {
              setShowForm(true);
              document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-8 py-4 bg-white text-orange-600 rounded-xl font-bold text-lg hover:bg-orange-50 transition-colors shadow-lg"
          >
            Apply Now
          </button>
        </div>
      </section>
    </div>
  );
}
