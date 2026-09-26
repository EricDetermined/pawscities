import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enrichEventHandle, isValidInstagramHandle } from '@/lib/handle-enrichment';

/**
 * Multi-business handle resolution (2026-09-26).
 *
 * Our whole site is about showcasing dog-friendly businesses, so every business
 * we feature in an event post should be @-tagged — not just the venue where we
 * found the event. A post that names "Boichik Bagels", "Fit Pals LA" and "DTLA
 * Dog Walking Club" but tags none of them wastes the single biggest funnel we
 * have (a tag notifies the business, which is how they discover us and claim a
 * listing).
 *
 * This extracts EVERY distinct business/organization named in an event
 * (organizer, host, venue, sponsors, participating businesses) and runs each
 * through the existing handle waterfall (cache → our own establishments DB →
 * Google Places → website scrape → web search). The resulting handles are
 * merged into the event's mentioned_handles so the caption tags them all.
 */

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const MAX_BUSINESSES = 6; // cap so a post never turns into a wall of @tags

/** Extract distinct business/organization names named in an event. */
export async function extractBusinessNames(event: {
  name?: string | null;
  description?: string | null;
  venue_name?: string | null;
}): Promise<string[]> {
  const names = new Set<string>();
  if (event.venue_name && event.venue_name.trim().length > 2) names.add(event.venue_name.trim());

  const openai = getOpenAI();
  const text = `${event.name || ''}\n${event.description || ''}`.trim();
  if (openai && text.length > 10) {
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You extract the real business or organization names mentioned in a dog event: the organizer(s), host(s), venue, sponsors, and any participating businesses (shops, cafes, brands, clubs). Return ONLY a JSON object {"businesses": string[]}. Use the proper business name as it would appear on Instagram (no "the" prefix unless part of the name). Exclude generic words (e.g. "dog park", "the pack", "pups"), cities, and event names. If none, return an empty array.',
          },
          { role: 'user', content: text.slice(0, 1500) },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });
      const raw = res.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as { businesses?: string[] };
      for (const n of parsed.businesses || []) {
        const clean = String(n).trim();
        if (clean.length > 2 && clean.length < 60) names.add(clean);
      }
    } catch (e) {
      console.error('[business-handles] extraction failed:', (e as Error)?.message);
    }
  }
  return [...names].slice(0, MAX_BUSINESSES);
}

export interface ResolvedBusiness { name: string; handle: string; source: string }

/**
 * Resolve Instagram handles for every business named in an event. Reuses the
 * venue handle waterfall per business name (which also caches results and
 * back-fills establishments.instagram_handle as a side effect, growing our DB).
 */
export async function resolveEventBusinessHandles(
  event: { name?: string | null; description?: string | null; venue_name?: string | null },
  supabase: SupabaseClient,
  cityName: string,
): Promise<ResolvedBusiness[]> {
  const names = await extractBusinessNames(event);
  const resolved: ResolvedBusiness[] = [];
  const seenHandles = new Set<string>();
  for (const name of names) {
    try {
      const r = await enrichEventHandle(
        { id: '', venue_name: name, venue_address: null, city_id: '', source_handle: null, mentioned_handles: [] } as unknown as Parameters<typeof enrichEventHandle>[0],
        supabase, cityName,
      );
      if (r.handle && isValidInstagramHandle(r.handle)) {
        const h = r.handle.replace(/^@/, '').toLowerCase();
        if (!seenHandles.has(h)) {
          seenHandles.add(h);
          resolved.push({ name, handle: r.handle.replace(/^@/, ''), source: r.source || 'unknown' });
        }
      }
    } catch (e) {
      console.error(`[business-handles] resolve failed for "${name}":`, (e as Error)?.message);
    }
  }
  return resolved;
}

/** Merge newly-resolved handles into an existing mentioned_handles list (deduped, capped). */
export function mergeHandles(existing: string[] | null, resolved: ResolvedBusiness[], cap = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of [...(existing || []).map(x => x.replace(/^@/, '')), ...resolved.map(r => r.handle)]) {
    const key = h.toLowerCase();
    if (h && !seen.has(key) && isValidInstagramHandle(h)) { seen.add(key); out.push(h); }
    if (out.length >= cap) break;
  }
  return out;
}
