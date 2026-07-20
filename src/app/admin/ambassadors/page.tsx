'use client';

import { useState, useEffect, useCallback } from 'react';

interface Invite {
  id: string;
  code: string;
  city: string | null;
  tier: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  max_uses: number;
  times_used: number;
  expires_at: string | null;
  created_at: string;
  notes: string | null;
}

interface Application {
  id: string;
  full_name: string;
  email: string;
  instagram_handle: string | null;
  city: string;
  why_join: string;
  how_explore: string;
  availability: string;
  follower_count: string | null;
  status: string;
  created_at: string;
  invite_code: string | null;
  referral_code: string | null;
}

interface ReferredBusiness {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  status: string;
  referred_by: string;
  created_at: string;
}

const CITIES = ['Atlanta', 'Barcelona', 'Geneva', 'London', 'Los Angeles', 'New York City', 'Paris', 'Sydney', 'Tokyo'];
const TIERS = [
  { value: '', label: 'No preference' },
  { value: 'explorer', label: 'Explorer' },
  { value: 'trailblazer', label: 'Trailblazer' },
  { value: 'pack_leader', label: 'Pack Leader' },
];

const TIER_COLORS: Record<string, string> = {
  explorer: 'bg-green-100 text-green-700',
  trailblazer: 'bg-blue-100 text-blue-700',
  pack_leader: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
};

export default function AmbassadorsAdminPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [referredBusinesses, setReferredBusinesses] = useState<ReferredBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'invites' | 'applications' | 'referrals'>('invites');

  // New invite form
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [city, setCity] = useState('');
  const [tier, setTier] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Expanded application
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ambassadors');
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
        setApplications(data.applications || []);
        setReferredBusinesses(data.referredBusinesses || []);
      }
    } catch (err) {
      console.error('Failed to fetch ambassador data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/admin/ambassadors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientName: recipientName || undefined,
          recipientEmail: recipientEmail || undefined,
          city: city || undefined,
          tier: tier || undefined,
          maxUses: parseInt(maxUses) || 1,
          expiresInDays: parseInt(expiresInDays) || undefined,
          notes: notes || undefined,
          sendInviteEmail: sendEmail && !!recipientEmail,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const emailNote = data.emailSent ? ' and email sent' : '';
        setSuccessMessage(`Invite ${data.invite.code} created${emailNote}! Link: ${data.invite.url}`);
        setRecipientName('');
        setRecipientEmail('');
        setCity('');
        setTier('');
        setMaxUses('1');
        setExpiresInDays('30');
        setNotes('');
        fetchData();
      } else {
        setErrorMessage(data.error || 'Failed to create invite');
      }
    } catch (err) {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const pendingApps = applications.filter(a => a.status === 'pending');
  const activeInvites = invites.filter(i => {
    if (i.times_used >= i.max_uses) return false;
    if (i.expires_at && new Date(i.expires_at) < new Date()) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ambassador Program</h1>
        <p className="text-gray-500 mt-1">Manage invitations and review applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Active Invites</p>
          <p className="text-2xl font-bold text-orange-600">{activeInvites.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Invites</p>
          <p className="text-2xl font-bold text-gray-700">{invites.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Pending Apps</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingApps.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Apps</p>
          <p className="text-2xl font-bold text-gray-700">{applications.length}</p>
        </div>
      </div>

      {/* Create Invite Form */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Invite</h2>
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="e.g. Sophie Martin"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="e.g. sophie@example.com"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                <option value="">Any city</option>
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Tier</label>
              <select
                value={tier}
                onChange={e => setTier(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                {TIERS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
              <input
                type="number"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                min="1"
                max="100"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires In (days)</label>
              <input
                type="number"
                value={expiresInDays}
                onChange={e => setExpiresInDays(e.target.value)}
                min="1"
                max="365"
                placeholder="30"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (internal)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Met at Geneva dog park meetup"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Send invite email to recipient</span>
            </label>
            {sendEmail && !recipientEmail && (
              <span className="text-xs text-amber-600">Enter an email to send the invite</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : sendEmail && recipientEmail ? 'Create & Send Invite' : 'Create Invite Code'}
            </button>
          </div>

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {successMessage}
              <button
                onClick={() => {
                  const match = successMessage.match(/Link: (.+)$/);
                  if (match) copyToClipboard(match[1]);
                }}
                className="ml-2 text-green-600 underline hover:no-underline"
              >
                Copy Link
              </button>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'invites'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Invite Codes ({invites.length})
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'applications'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Applications ({applications.length})
          {pendingApps.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
              {pendingApps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'referrals'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Referrals ({referredBusinesses.length})
        </button>
      </div>

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {invites.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No invite codes yet. Create one above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Code</th>
                    <th className="text-left p-3 font-medium text-gray-600">Recipient</th>
                    <th className="text-left p-3 font-medium text-gray-600">City</th>
                    <th className="text-left p-3 font-medium text-gray-600">Tier</th>
                    <th className="text-left p-3 font-medium text-gray-600">Usage</th>
                    <th className="text-left p-3 font-medium text-gray-600">Status</th>
                    <th className="text-left p-3 font-medium text-gray-600">Created</th>
                    <th className="text-left p-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(invite => {
                    const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                    const isUsedUp = invite.times_used >= invite.max_uses;
                    const isActive = !isExpired && !isUsedUp;

                    return (
                      <tr key={invite.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <code className="text-orange-600 font-mono font-semibold text-xs bg-orange-50 px-2 py-1 rounded">
                            {invite.code}
                          </code>
                        </td>
                        <td className="p-3">
                          <div className="text-gray-900">{invite.recipient_name || '—'}</div>
                          <div className="text-gray-400 text-xs">{invite.recipient_email || ''}</div>
                        </td>
                        <td className="p-3 text-gray-600">{invite.city || '—'}</td>
                        <td className="p-3">
                          {invite.tier ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[invite.tier] || 'bg-gray-100 text-gray-600'}`}>
                              {invite.tier.replace('_', ' ')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-gray-600">
                          {invite.times_used} / {invite.max_uses}
                        </td>
                        <td className="p-3">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Expired</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Used</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400 text-xs">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => copyToClipboard(`https://pawcities.com/ambassadors?invite=${invite.code}`)}
                            className="text-orange-500 hover:text-orange-700 text-xs font-medium"
                            title="Copy invite link"
                          >
                            Copy Link
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Referrals Tab */}
      {activeTab === 'referrals' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {referredBusinesses.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="mb-2">No referred businesses yet.</p>
              <p className="text-xs">When an ambassador shares their referral link and a business signs up, it will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Business</th>
                    <th className="text-left p-3 font-medium text-gray-600">Contact</th>
                    <th className="text-left p-3 font-medium text-gray-600">Referred By</th>
                    <th className="text-left p-3 font-medium text-gray-600">Claim Status</th>
                    <th className="text-left p-3 font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referredBusinesses.map(biz => {
                    // Try to find the ambassador who owns this referral code
                    const ambassador = applications.find(a => a.referral_code === biz.referred_by);
                    return (
                      <tr key={biz.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{biz.business_name}</td>
                        <td className="p-3">
                          <div className="text-gray-900">{biz.contact_name}</div>
                          <div className="text-gray-400 text-xs">{biz.contact_email}</div>
                        </td>
                        <td className="p-3">
                          <code className="text-orange-600 font-mono text-xs bg-orange-50 px-2 py-1 rounded">
                            {biz.referred_by}
                          </code>
                          {ambassador && (
                            <div className="text-xs text-gray-500 mt-1">
                              {ambassador.full_name} ({ambassador.city})
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            biz.status === 'APPROVED' ? 'bg-green-100 text-green-700'
                              : biz.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {biz.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400 text-xs">
                          {new Date(biz.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {applications.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              No applications received yet.
            </div>
          ) : (
            applications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border overflow-hidden">
                <button
                  onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-600'}`}>
                      {app.status}
                    </span>
                    <span className="font-medium text-gray-900">{app.full_name}</span>
                    <span className="text-gray-400 text-sm">{app.email}</span>
                    <span className="text-gray-400 text-sm">{app.city}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[app.availability] || 'bg-gray-100 text-gray-600'}`}>
                      {app.availability.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedApp === app.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedApp === app.id && (
                  <div className="border-t p-4 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Instagram</p>
                        <p className="text-sm text-gray-900">
                          {app.instagram_handle ? `@${app.instagram_handle}` : 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Follower Count</p>
                        <p className="text-sm text-gray-900">{app.follower_count || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Invite Code Used</p>
                        <p className="text-sm text-gray-900 font-mono">{app.invite_code || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Referral Code</p>
                        <p className="text-sm text-gray-900 font-mono">{app.referral_code || '—'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Why They Want to Join</p>
                      <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border">{app.why_join}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">How They Explore Their City</p>
                      <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border">{app.how_explore}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
