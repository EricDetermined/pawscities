'use client';

import React, { useCallback, useEffect, useState } from 'react';

// ── Marketing command center (2026-09-24) ────────────────────────────────────
// Full visibility across the growth machine: agent health, the claims funnel,
// email + DM outreach, and localization coverage — one page Eric can reopen any
// time to confirm nothing is silently stuck.

interface Heartbeat { agent: string; status: string; detail: string; at: string | null }
interface LocaleRow { code: string; label: string; establishments: number; events: number; estPct: number; evtPct: number }

interface AttentionItem { kind: string; severity: 'critical' | 'warn' | 'info'; label: string; detail: string; count: number; examples: string[] }
interface OutreachFunnel {
  inventory: { activeListings: number; unclaimed: number; readyToEmail: number; readyToDm: number; missingEmail: number; optedOut: number };
  dm: { sent: number; replied: number; replyRate: number; linksDelivered: number; clicked: number; clickRate: number; claimed: number; sent7d: number; replied7d: number };
  email: { invitesSent: number; clicked: number; clickRate: number; claimed: number; sent7d: number; clicked7d: number };
  claims: { total: number; last7d: number; last30d: number };
  tokens: { outstanding: number; expiringSoon: number; expiredUnused: number };
  attention: AttentionItem[];
}

interface MarketingData {
  generatedAt: string;
  funnel: OutreachFunnel | null;
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

// One row of the reach → reply → link → click → claim chain, so a channel that
// stalls at a particular step is obvious at a glance rather than inferred.
function FunnelRow({ label, value, of, color }: { label: string; value: number; of: number; color: string }) {
  const p = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{value}<span className="text-gray-400 font-normal"> · {p}%</span></span>
      </div>
      <Bar pct={p} color={color} />
    </div>
  );
}

const SEVERITY: Record<string, { dot: string; text: string; badge: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-red-200' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  info: { dot: 'bg-gray-400', text: 'text-gray-600', badge: 'bg-gray-50 text-gray-600 border-gray-200' },
};

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

  const { claims, email, dms, invites, localization, agents, funnel } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📣 Marketing Command Center</h1>
          <p className="text-sm text-gray-500">Full visibility across outreach, claims, and localization · updated {ago(data.generatedAt)}</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Refresh</button>
      </div>

      {/* Needs attention — anything stalled, worst first */}
      {funnel && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Needs Attention</h2>
          {funnel.attention.length === 0 ? (
            <div className="bg-white border rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              Nothing stalled. Every reply has a claim link, agents are reporting, and both send queues have inventory.
            </div>
          ) : (
            <div className="bg-white border rounded-xl divide-y">
              {funnel.attention.map((a) => {
                const s = SEVERITY[a.severity] || SEVERITY.info;
                return (
                  <div key={a.kind} className="p-4 flex gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${s.text}`}>{a.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${s.badge}`}>{a.count}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{a.detail}</div>
                      {a.examples.length > 0 && (
                        <div className="text-xs text-gray-700 mt-1 font-mono break-words">{a.examples.join(' · ')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Outreach funnel by channel */}
      {funnel && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">Outreach Funnel by Channel</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-gray-900">Instagram DM</h3>
                <span className="text-xs text-gray-400">{funnel.dm.sent7d} sent · {funnel.dm.replied7d} replied (7d)</span>
              </div>
              <FunnelRow label="DMs sent" value={funnel.dm.sent} of={funnel.dm.sent} color="#0369a1" />
              <FunnelRow label="Replied" value={funnel.dm.replied} of={funnel.dm.sent} color="#0ea5e9" />
              <FunnelRow label="Claim link delivered" value={funnel.dm.linksDelivered} of={funnel.dm.sent} color="#6366f1" />
              <FunnelRow label="Link opened" value={funnel.dm.clicked} of={funnel.dm.sent} color="#8b5cf6" />
              <FunnelRow label="Listing claimed" value={funnel.dm.claimed} of={funnel.dm.sent} color="#059669" />
            </div>
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-gray-900">Email invite</h3>
                <span className="text-xs text-gray-400">{funnel.email.sent7d} sent · {funnel.email.clicked7d} opened (7d)</span>
              </div>
              <FunnelRow label="Invites emailed" value={funnel.email.invitesSent} of={funnel.email.invitesSent} color="#2563eb" />
              <FunnelRow label="Link opened" value={funnel.email.clicked} of={funnel.email.invitesSent} color="#8b5cf6" />
              <FunnelRow label="Listing claimed" value={funnel.email.claimed} of={funnel.email.invitesSent} color="#059669" />
              <p className="text-xs text-gray-400 pt-1">
                Email links carry their own verification, so there is no reply step: the business goes straight from inbox to claim.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <Stat label="Ready to email today" value={funnel.inventory.readyToEmail} sub="queued for the send cron" color={funnel.inventory.readyToEmail ? '#2563eb' : '#b45309'} />
            <Stat label="Ready to DM today" value={funnel.inventory.readyToDm} sub="unclaimed, has IG handle" color={funnel.inventory.readyToDm < 10 ? '#b45309' : '#0369a1'} />
            <Stat label="Links outstanding" value={funnel.tokens.outstanding} sub={`${funnel.tokens.expiringSoon} expiring within 7d`} />
            <Stat label="Claims won" value={funnel.claims.total} sub={`${funnel.claims.last7d} in the last 7 days`} color="#059669" />
          </div>
        </section>
      )}

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
