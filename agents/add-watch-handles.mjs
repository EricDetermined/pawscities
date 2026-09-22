#!/usr/bin/env node
/**
 * add-watch-handles.mjs — net-new handle intake for the compounding discovery loop.
 *
 * The hashtag-location-discovery browser sweep harvests post-OWNER handles from
 * per-city Instagram Explore/hashtag/location pages (usernames are visible in the
 * DOM there, unlike the Graph API), semantically vets them, then pipes the
 * candidates here. This script normalizes, blocks self/competitors, DEDUPES
 * against watch_handles, and inserts only the genuinely new accounts with
 * source='hashtag-discovery', active=true. From then on the free server-side
 * handle-discovery cron mines them forever — that's the compounding growth loop.
 *
 * Usage:
 *   node agents/add-watch-handles.mjs candidates.json
 *   node agents/add-watch-handles.mjs -                 # read JSON from stdin
 *   node agents/add-watch-handles.mjs candidates.json --dry-run
 *   node agents/add-watch-handles.mjs candidates.json --source=hashtag-discovery
 *
 * Candidate JSON: array of objects
 *   [{ "handle": "ladogclub", "city": "losangeles", "handle_type": "organizer", "notes": "#ladogevents" }, ...]
 * city must be one of the 9 slugs; handle_type: venue|organizer|community|brand|unknown.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const CITIES = new Set(['losangeles','newyork','london','paris','barcelona','tokyo','sydney','geneva','atlanta']);
const TYPES = new Set(['venue','organizer','community','brand','unknown']);
// Never watch our own accounts or competitors.
const BLOCK = new Set(['thepawcities','pawcities','pawscities','bringfido','bring_fido']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sourceArg = (args.find(a => a.startsWith('--source=')) || '--source=hashtag-discovery').split('=')[1];
const inputArg = args.find(a => !a.startsWith('--')) || '-';

function loadEnv() {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  );
  return env;
}

function normalizeHandle(raw) {
  if (typeof raw !== 'string') return null;
  let h = raw.trim().toLowerCase();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/+$/, '');
  h = h.replace(/^@+/, '');
  h = h.split(/[/?#]/)[0]; // drop any trailing path/query
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;   // valid IG username charset
  if (/^\.|\.$|\.\./.test(h)) return null;          // IG disallows leading/trailing/double dots
  return h;
}

function readInput() {
  const text = inputArg === '-' ? readFileSync(0, 'utf8') : readFileSync(inputArg, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('input must be a JSON array of candidates');
  return data;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const raw = readInput();
  const seen = new Set();
  const clean = [];
  const rejected = [];
  for (const c of raw) {
    const handle = normalizeHandle(c && c.handle);
    if (!handle) { rejected.push({ in: c && c.handle, why: 'invalid-handle' }); continue; }
    if (BLOCK.has(handle)) { rejected.push({ in: handle, why: 'blocked-self-or-competitor' }); continue; }
    if (seen.has(handle)) continue; // in-batch dupe
    seen.add(handle);
    const city = CITIES.has(c.city) ? c.city : null;
    const handle_type = TYPES.has(c.handle_type) ? c.handle_type : 'unknown';
    clean.push({ handle, city, handle_type, source: sourceArg, active: true, notes: (c.notes || '').slice(0, 300) || null });
  }

  if (clean.length === 0) {
    console.log(JSON.stringify({ added: 0, existing: 0, rejected: rejected.length, rejects: rejected.slice(0, 20) }, null, 2));
    return;
  }

  // Dedupe against watch_handles by handle (chunked .in query).
  const existing = new Set();
  const handles = clean.map(c => c.handle);
  for (let i = 0; i < handles.length; i += 200) {
    const chunk = handles.slice(i, i + 200);
    const { data, error } = await sb.from('watch_handles').select('handle').in('handle', chunk);
    if (error) throw new Error('dedupe query failed: ' + error.message);
    for (const r of data) existing.add(r.handle.toLowerCase());
  }
  const toAdd = clean.filter(c => !existing.has(c.handle));

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true, wouldAdd: toAdd.length, existing: clean.length - toAdd.length, rejected: rejected.length,
      sample: toAdd.slice(0, 15).map(c => `${c.handle} [${c.city || '?'}/${c.handle_type}]`),
    }, null, 2));
    return;
  }

  let added = 0;
  for (let i = 0; i < toAdd.length; i += 100) {
    const chunk = toAdd.slice(i, i + 100);
    const { error } = await sb.from('watch_handles').insert(chunk);
    if (error) {
      // Fall back to per-row on conflict (unique handle) so one dupe doesn't sink the batch.
      for (const row of chunk) {
        const { error: e2 } = await sb.from('watch_handles').insert(row);
        if (!e2) added++;
      }
    } else {
      added += chunk.length;
    }
  }

  console.log(JSON.stringify({
    added, existing: clean.length - toAdd.length, rejected: rejected.length,
    addedHandles: toAdd.map(c => c.handle),
  }, null, 2));
}

main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
