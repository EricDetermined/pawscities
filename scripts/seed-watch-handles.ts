/**
 * Seed script: populate the watch_handles registry for the handle-discovery
 * cron (Instagram Graph API business discovery channel).
 *
 * Sources:
 *   1. data/venue-leads.jsonl        — accumulated venue/organizer leads
 *   2. Supabase events table         — source_handle + mentioned_handles
 *   3. data/target-handles.json      — vetted business/venue/organizer registry
 *      (event-discovery/route.ts has no hard-coded organizer handles; this
 *      file is the repo's known-good handle registry)
 *
 * Hard exclusions: thepawcities, anything bringfido-related (competitor),
 * platform names, engagement blocklist, junk/system labels.
 *
 * Usage:
 *   npx tsx scripts/seed-watch-handles.ts [--dry-run]
 *
 * Requires migration 030_watch_handles.sql to have been applied.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Exclusions ─────────────────────────────────────────────────────────────

// NEVER include bringfido or anything bringfido-related (competitor).
const HARD_EXCLUDE_SUBSTRINGS = ['bringfido'];

const EXCLUDED_HANDLES = new Set([
  'thepawcities', 'pawcities', 'instagram', 'facebook', 'unknown', 'admin',
  'google_events', 'curated_scrape', 'google', 'meta', 'threads', 'tiktok',
  'eventbrite', 'meetup', 'youtube', 'twitter',
]);

const HANDLE_RE = /^[a-z0-9._]{3,30}$/;

function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let h = String(raw).trim().toLowerCase();
  h = h.replace(/^@/, '');
  // Some leads look like "@polokunkun (venue: PARLORS)" — keep the handle only
  h = h.split(/[\s(]/)[0];
  h = h.replace(/[.,;:!?]+$/, '');
  if (!HANDLE_RE.test(h)) return null;
  if (/^\d+$/.test(h)) return null;
  if (EXCLUDED_HANDLES.has(h)) return null;
  if (HARD_EXCLUDE_SUBSTRINGS.some((s) => h.includes(s))) return null;
  return h;
}

// ─── City normalization → site slugs ────────────────────────────────────────

const CITY_SLUGS = new Set([
  'atlanta', 'losangeles', 'newyork', 'london', 'paris',
  'barcelona', 'tokyo', 'sydney', 'geneva',
]);

function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, string> = {
    newyorkcity: 'newyork', nyc: 'newyork', ny: 'newyork',
    la: 'losangeles', ldn: 'london', bcn: 'barcelona',
  };
  const resolved = aliases[c] || c;
  return CITY_SLUGS.has(resolved) ? resolved : null;
}

// ─── handle_type inference ──────────────────────────────────────────────────

function inferType(rawType: string | null | undefined, note: string | null | undefined): string {
  const t = `${rawType || ''} ${note || ''}`.toLowerCase();
  if (/organi[sz]er|event.?calendar|event.?roundup|event.?series|event.?lead|dog.?week|festival/.test(t)) return 'organizer';
  if (/venue|cafe|café|restaurant|hotel|bar|brewery|daycare|groom|boutique|shop|store|attraction|park|studio|clinic|vet|bakery|pet.?supply/.test(t)) return 'venue';
  if (/community|ally|roundup|club|nonprofit|rescue|shelter|foundation|media/.test(t)) return 'community';
  if (/brand|sponsor|supply|product/.test(t)) return 'brand';
  if (/business/.test(t)) return 'venue';
  return 'unknown';
}

// ─── Candidate collection ───────────────────────────────────────────────────

interface Candidate {
  handle: string;
  city: string | null;
  handle_type: string;
  source: string;
  notes: string | null;
}

async function main() {
  const root = path.join(__dirname, '..');
  const candidates = new Map<string, Candidate>();

  const blocklist = new Set<string>();
  try {
    const bl = JSON.parse(fs.readFileSync(path.join(root, 'data', 'engagement-blocklist.json'), 'utf8'));
    for (const k of Object.keys(bl)) {
      if (!k.startsWith('_')) blocklist.add(k.toLowerCase());
    }
  } catch { /* blocklist optional */ }

  const add = (raw: string | null | undefined, city: string | null, type: string, source: string, notes: string | null) => {
    const handle = normalizeHandle(raw);
    if (!handle || blocklist.has(handle)) return;
    const existing = candidates.get(handle);
    if (existing) {
      // Fill gaps from later sources, never overwrite earlier data
      if (!existing.city && city) existing.city = city;
      if (existing.handle_type === 'unknown' && type !== 'unknown') existing.handle_type = type;
      return;
    }
    candidates.set(handle, { handle, city, handle_type: type, source, notes });
  };

  // ── Source 1: data/venue-leads.jsonl ──────────────────────────────────────
  const leadsPath = path.join(root, 'data', 'venue-leads.jsonl');
  let leadCount = 0;
  if (fs.existsSync(leadsPath)) {
    for (const line of fs.readFileSync(leadsPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let lead: Record<string, unknown>;
      try { lead = JSON.parse(line); } catch { continue; }
      const rawHandle = (lead.handle || lead.source_handle) as string | undefined;
      const city = normalizeCity(lead.city as string | undefined);
      const note = ((lead.note || lead.notes || lead.event || lead.venue_lead || '') as string).substring(0, 300) || null;
      const type = inferType(lead.type as string | undefined, note);
      if (rawHandle) {
        add(rawHandle, city, type, 'venue-leads', note);
        leadCount++;
      }
      // Some leads carry extra handles in notes ("@streetvetuk_", etc.)
      const mentioned = (note || '').match(/@([a-zA-Z0-9_.]{3,30})/g) || [];
      for (const m of mentioned) add(m, city, 'unknown', 'venue-leads-note', null);
    }
  }
  console.log(`[SEED] venue-leads.jsonl: ${leadCount} primary leads parsed`);

  // ── Source 2: events table (source_handle + mentioned_handles) ────────────
  const { data: cities } = await supabase.from('cities').select('id, slug');
  const citySlugById: Record<string, string> = {};
  for (const c of cities || []) citySlugById[c.id] = c.slug;

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('source_handle, mentioned_handles, city_id, name')
    .limit(2000);
  if (evErr) {
    console.error('[SEED] events fetch failed:', evErr.message);
  } else {
    let fromEvents = 0;
    for (const ev of events || []) {
      const city = normalizeCity(citySlugById[ev.city_id]) || null;
      if (ev.source_handle) {
        add(ev.source_handle, city, 'organizer', 'events-source-handle', ev.name ? `posted event: ${ev.name}`.substring(0, 200) : null);
        fromEvents++;
      }
      for (const mh of (ev.mentioned_handles as string[] | null) || []) {
        add(mh, city, 'unknown', 'events-mentioned', ev.name ? `mentioned in: ${ev.name}`.substring(0, 200) : null);
        fromEvents++;
      }
    }
    console.log(`[SEED] events table: ${events?.length ?? 0} events scanned, ${fromEvents} handle refs`);
  }

  // ── Source 3: data/target-handles.json (vetted registry) ──────────────────
  const thPath = path.join(root, 'data', 'target-handles.json');
  if (fs.existsSync(thPath)) {
    const th = JSON.parse(fs.readFileSync(thPath, 'utf8')) as Record<string, unknown>;
    let fromTargets = 0;
    for (const [rawHandle, meta] of Object.entries(th)) {
      let city: string | null = null;
      let type = 'unknown';
      let note: string | null = null;
      if (typeof meta === 'string') {
        // "event-organizer:london" format
        const [t, c] = meta.includes(':') ? meta.split(':', 2) : [meta, ''];
        city = normalizeCity(c);
        type = inferType(t, null);
        note = meta.substring(0, 200);
      } else if (meta && typeof meta === 'object') {
        const m = meta as Record<string, string>;
        city = normalizeCity(m.city);
        type = inferType(m.type, null);
        note = m.source ? `target-handles: ${m.source}`.substring(0, 200) : null;
      }
      add(rawHandle, city, type, 'target-handles', note);
      fromTargets++;
    }
    console.log(`[SEED] target-handles.json: ${fromTargets} vetted handles`);
  }

  // ─── Insert ───────────────────────────────────────────────────────────────
  const rows = Array.from(candidates.values());
  console.log(`[SEED] ${rows.length} unique candidate handles after normalization/dedup`);

  const byCity: Record<string, number> = {};
  for (const r of rows) byCity[r.city || '(unknown)'] = (byCity[r.city || '(unknown)'] || 0) + 1;
  console.log('[SEED] By city:', JSON.stringify(byCity, null, 2));

  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.handle_type] = (byType[r.handle_type] || 0) + 1;
  console.log('[SEED] By type:', JSON.stringify(byType));

  if (DRY_RUN) {
    console.log('[SEED] Dry run — nothing written. Sample:', rows.slice(0, 10));
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error, count } = await supabase
      .from('watch_handles')
      .upsert(batch, { onConflict: 'handle', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      console.error(`[SEED] Batch ${i / 100} failed:`, error.message);
      continue;
    }
    inserted += count ?? batch.length;
  }
  const { count: total } = await supabase
    .from('watch_handles')
    .select('*', { count: 'exact', head: true });
  skipped = rows.length - inserted;
  console.log(`[SEED] Done. Inserted ${inserted}, skipped ${skipped} (already present). watch_handles total: ${total}`);
}

main().catch((err) => {
  console.error('[SEED] Fatal:', err);
  process.exit(1);
});
