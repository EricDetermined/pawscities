import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { verifyCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Content translation (Phase 2 i18n, 2026-09-24).
 *
 * Establishment and event descriptions render in the visitor's locale via
 * src/i18n/content.ts `localizedDescription`, which reads per-locale columns
 * (description_fr / _es / _ja / _ca) and falls back to the base English
 * `description`. This cron machine-translates the English description into each
 * target locale with gpt-4o-mini and fills those columns.
 *
 * Paced like enrich-contact-emails: an app_config cursor
 * ('translate_content_cursor') stores which table we're on and how far we've
 * paged (last created_at). Each run takes the next BATCH of rows that still have
 * a missing translation, so the whole directory is covered over several days
 * without a single expensive run. Establishments are processed first, then
 * events; when both are done the cursor resets for another pass (which only
 * re-touches rows still missing a translation, e.g. newly added rows).
 *
 * Names are proper nouns and are never translated — only descriptions.
 */

const BATCH = 15;
// Safety cap so a run stays within maxDuration. 15 rows x 4 locales = 60 calls.
const MAX_CALLS = 60;
const CURSOR_KEY = 'translate_content_cursor';

const TARGET_LOCALES = ['fr', 'es', 'ca', 'ja'] as const;
type TargetLocale = (typeof TARGET_LOCALES)[number];

const LANGUAGE_NAMES: Record<TargetLocale, string> = {
  fr: 'French',
  es: 'Spanish (Castilian)',
  ca: 'Catalan',
  ja: 'Japanese',
};

// Establishments first, then events.
const TABLES = ['establishments', 'events'] as const;
type Table = (typeof TABLES)[number];

interface CursorState {
  table: Table;
  cursor: string; // last created_at processed within `table`
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function parseCursor(raw: string | null | undefined): CursorState {
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<CursorState>;
      if (p && (p.table === 'establishments' || p.table === 'events')) {
        return { table: p.table, cursor: typeof p.cursor === 'string' ? p.cursor : '' };
      }
    } catch { /* fall through to default */ }
  }
  return { table: 'establishments', cursor: '' };
}

function nextTable(table: Table): Table {
  return table === 'establishments' ? 'events' : 'establishments';
}

function nonEmpty(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Translate one description into one target language. Returns null on failure. */
async function translateOne(openai: OpenAI, text: string, locale: TargetLocale): Promise<string | null> {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator for a dog-friendly city guide. Translate the text into ${LANGUAGE_NAMES[locale]}. Keep it natural and concise, preserve meaning and tone, do NOT translate proper nouns / business names / place names. Return only the translation, no quotes or notes.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });
    return res.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error(`[TRANSLATE] ${locale} translation failed:`, err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const openai = getOpenAI();
  if (!openai) {
    return NextResponse.json({ status: 'no_openai_key' }, { status: 200 });
  }

  const sb = admin();

  // Read cursor (which table + how far we've paged).
  const { data: cfg } = await sb.from('app_config').select('value').eq('key', CURSOR_KEY).maybeSingle();
  const state = parseCursor(cfg?.value);
  const table = state.table;

  // Rows with a non-empty English description but at least one missing translation.
  let q = sb.from(table)
    .select('id, description, description_fr, description_es, description_ca, description_ja, created_at')
    .not('description', 'is', null)
    .neq('description', '')
    .or('description_fr.is.null,description_es.is.null,description_ca.is.null,description_ja.is.null')
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (state.cursor) q = q.gt('created_at', state.cursor);

  const { data: rows, error } = await q;
  if (error) {
    // Likely the migration hasn't been applied yet — don't 500 the cron.
    console.error(`[TRANSLATE] query failed for ${table}:`, error.message);
    return NextResponse.json({ status: 'query_error', table, error: error.message }, { status: 200 });
  }

  // End of this table's pass → advance to the next table (or reset the cycle).
  if (!rows || rows.length === 0) {
    const upcoming = nextTable(table);
    const next: CursorState = { table: upcoming, cursor: '' };
    await sb.from('app_config').upsert({ key: CURSOR_KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() });
    return NextResponse.json({
      status: table === 'events' ? 'cycle_complete' : 'table_complete',
      table,
      attempted: 0,
      translated: 0,
      cursor: JSON.stringify(next),
    });
  }

  let attempted = 0;
  let translated = 0;
  let calls = 0;

  for (const row of rows) {
    if (calls >= MAX_CALLS) break;
    attempted++;
    const source = String((row as Record<string, unknown>).description || '');
    if (!source.trim()) continue;

    const updates: Record<string, string> = {};
    for (const locale of TARGET_LOCALES) {
      if (calls >= MAX_CALLS) break;
      const existing = (row as Record<string, unknown>)[`description_${locale}`];
      if (nonEmpty(existing)) continue;
      calls++;
      const out = await translateOne(openai, source, locale);
      if (out) {
        updates[`description_${locale}`] = out;
        translated++;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await sb.from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', (row as { id: string }).id);
      } catch (err) {
        console.error(`[TRANSLATE] update failed for ${table} ${(row as { id: string }).id}:`, err);
      }
    }
  }

  // Advance the cursor to the last row we looked at within this table.
  const last = (rows[rows.length - 1] as { created_at: string }).created_at;
  const nextState: CursorState = { table, cursor: last };
  await sb.from('app_config').upsert({ key: CURSOR_KEY, value: JSON.stringify(nextState), updated_at: new Date().toISOString() });

  return NextResponse.json({
    status: 'ok',
    table,
    attempted,
    translated,
    cursor: JSON.stringify(nextState),
  });
}
