'use client';

import React, { useCallback, useEffect, useState } from 'react';

// ── Marketing command center (2026-09-24) ────────────────────────────────────
// Full visibility across the growth machine: agent health, the claims funnel,
// email + DM outreach, and localization coverage — one page Eric can reopen any
// time to confirm nothing is silently stuck.

interface Heartbeat { agent: string; status: string; detail: string; at: string | null }
interface LocaleRow { code: string; label: string; establishments: number; events: number; estPct: number; evtPct: number }

interface MarketingData {
  generatedAt: string;
  claims: { activeListings: number; claimedListings: number; unclaimedContactable: number; pendingListings: number; claimRate: number };
  email: { gathered: number; missing: number; coverage: number; cursorDone: boolean };
  dms: { sent: number; followerBusinesses: number; followerUnclaimed: number };
  invites: { sent: number; claimedTotal: number; bySource: { email: number; dm: number; ambassador: number; organic: number; other: number } };
  localization: { establishmentsWithDescription: number; eventsWithDescription: number; byLocale: LocaleRow[] };
  agents: { heartbeats: Heartbeat[]; igLock: { active: boolean; since: string | null; stale: boolean } };
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (Number.isNaN(s)) return 'unknown';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// An agent whose last heartbeat is older than this is treated as stale.
const STALE_HOURS = 36;
function isStale(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - Date.parse(iso) > STALE_HOURS * 3600 * 1000;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-2xl font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function MarketingPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing');
      if (!res.ok) { setErr(`Failed to load (${res.status})`); setLoading(false); return; }
      setData(await res.json());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <div className="p-6 text-gray-500">Loading marketing command center…</div>;
  if (err && !data) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return null;

  const { claims, email, dms, invites, localization, agents } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📣 Marketing Command Center</h1>
          <p className="text-sm text-gray-500">Full visibility across outreach, claims, and localization · updated {ago(data.generatedAt)}</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Refresh</button>
      </div>

      {/* Agent health */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Agent Health</h2>
        <div className="bg-white border rounded-xl divide-y">
          {agents.heartbeats.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No agent heartbeats recorded yet. They will appear here after each agent&apos;s next run.</div>
          )}
          {agents.heartbeats.map((h) => {
            const stale = isStale(h.at);
            const bad = h.status !== 'ok' || stale;
            return (
              <div key={h.agent} className="flex items-center gap-3 p-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bad ? 'bg-red-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{h.agent}</div>
                  {h.detail && <div className="text-xs text-gray-500 truncate">{h.detail}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-medium ${bad ? 'text-red-600' : 'text-green-600'}`}>{stale ? 'stale' : h.status}</div>
                  <div className="text-xs text-gray-400">{ago(h.at)}</div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-3 p-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${agents.igLock.active ? 'bg-amber-500' : 'bg-gray-300'}`} />
            <div className="flex-1 text-sm text-gray-700">Instagram activity lock</div>
            <div className="text-xs text-gray-400">{agents.igLock.active ? `held ${ago(agents.igLock.since)}` : agents.igLock.stale ? 'stale (cleared)' : 'free'}</div>
          </div>
        </div>
      </section>

      {/* Claims funnel */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Claims Funnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <Stat label="Live listings" value={claims.activeListings} />
          <Stat label="Claimed" value={claims.claimedListings} color="#059669" />
          <Stat label="Unclaimed & contactable" value={claims.unclaimedContactable} color="#b45309" />
          <Stat label="Pending review" value={claims.pendingListings} sub="awaiting approval" color="#7c3aed" />
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Claim rate</span><span className="font-medium">{claims.claimRate}%</span></div>
          <Bar pct={claims.claimRate} color="#059669" />
        </div>
      </section>

      {/* Email outreach */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Email Enrichment</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <Stat label="Emails gathered" value={email.gathered} color="#059669" />
          <Stat label="Still missing (has website)" value={email.missing} color="#b45309" />
          <Stat label="Enrichment run" value={email.cursorDone ? 'Caught up' : 'In progress'} sub="daily cron" />
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">Contactable-by-email coverage</span><span className="font-medium">{email.coverage}%</span></div>
          <Bar pct={email.coverage} color="#2563eb" />
        </div>
      </section>

      {/* Email invite engine */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Email Invite Engine</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Invites emailed" value={invites.sent} sub="one-click claim links" color="#2563eb" />
          <Stat label="Claims won (all channels)" value={invites.claimedTotal} color="#059669" />
          <Stat label="Emails ready to invite" value={email.gathered} sub="in the send queue" />
        </div>
      </section>

      {/* Claims by channel */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Claims by Channel</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Email invite" value={invites.bySource.email} color="#2563eb" />
          <Stat label="Instagram DM" value={invites.bySource.dm} color="#0369a1" />
          <Stat label="Ambassador" value={invites.bySource.ambassador} color="#7c3aed" />
          <Stat label="Organic" value={invites.bySource.organic} />
          <Stat label="Older / untagged" value={invites.bySource.other} color="#9ca3af" />
        </div>
      </section>

      {/* DM outreach */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">DM Outreach</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="DMs sent (total)" value={dms.sent} />
          <Stat label="Follower businesses listed" value={dms.followerBusinesses} sub="warm leads" color="#0369a1" />
          <Stat label="Follower biz still unclaimed" value={dms.followerUnclaimed} sub="priority DM targets" color="#b45309" />
        </div>
      </section>

      {/* Localization */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Localization Coverage</h2>
        <div className="bg-white border rounded-xl p-4 space-y-4">
          <p className="text-xs text-gray-500">
            {localization.establishmentsWithDescription} listings and {localization.eventsWithDescription} events have English descriptions to translate.
          </p>
          {localization.byLocale.map((l) => (
            <div key={l.code}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-800">{l.label}</span>
                <span className="text-gray-500">Listings {l.estPct}% · Events {l.evtPct}%</span>
              </div>
              <div className="space-y-1">
                <Bar pct={l.estPct} color="#6366f1" />
                <Bar pct={l.evtPct} color="#a5b4fc" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
