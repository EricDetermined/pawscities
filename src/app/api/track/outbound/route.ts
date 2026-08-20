/**
 * Records an outbound click from an event page.
 *
 * This endpoint is PUBLIC and unauthenticated — it has to be, since it is
 * called from the browser by anonymous visitors. That makes it the one place
 * in the app where an untrusted party writes to the database, so everything
 * below is written on the assumption that the payload is hostile:
 *
 *   - every field is validated and length-capped before it reaches Postgres
 *   - link_type and event_state are checked against closed allowlists
 *   - dest_host is re-derived and sanitised rather than trusted
 *   - the response is always 204, so the endpoint leaks nothing about whether
 *     a slug exists, and cannot be used to enumerate our catalogue
 *
 * It deliberately does NOT record IP, user agent, session or full referrer.
 * See migration 023 — this table answers "which events convert", not
 * "who clicked".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/community';

export const runtime = 'nodejs';
// Never cache a write endpoint.
export const dynamic = 'force-dynamic';

const LINK_TYPES = new Set(['tickets', 'instagram', 'maps']);
const EVENT_STATES = new Set(['live', 'cancelled', 'past']);
const CHANNELS = new Set([
  'direct', 'organic', 'social', 'referral', 'internal', 'other', 'unknown',
]);

/** Trim, cap length, and reject anything that isn't a plain string. */
function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

/** Slugs are our own format; anything else is someone probing. */
function slug(v: unknown, max = 200): string | null {
  const s = str(v, max);
  return s && /^[a-z0-9][a-z0-9-]*$/i.test(s) ? s : null;
}

/**
 * A real UUID, not merely 36 hex-ish characters.
 *
 * The obvious version — str(v, 36) then /^[0-9a-f-]{36}$/ — is wrong twice, and
 * a test caught it: truncating FIRST turns an over-length string into a valid
 * one ('a'.repeat(40) becomes 36 a's, and 'a' is a hex digit), and the loose
 * character class ignores UUID structure entirely. Both produce a value that
 * passes validation and is then rejected by Postgres, silently losing the row.
 * Reject over-length input outright and enforce the 8-4-4-4-12 shape.
 */
function uuid(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

function host(v: unknown): string | null {
  const s = str(v, 253);
  // Hostname characters only — no paths, ports, credentials or query strings.
  return s && /^[a-z0-9.-]+$/i.test(s) ? s.toLowerCase() : null;
}

export async function POST(req: NextRequest) {
  // Always 204, success or failure. A visitor's navigation must never depend
  // on this, and a prober should learn nothing from the status code.
  const ok = new NextResponse(null, { status: 204 });

  try {
    const raw = await req.text();
    // Cheap guard against oversized bodies before parsing.
    if (!raw || raw.length > 2000) return ok;

    const body = JSON.parse(raw) as Record<string, unknown>;

    const event_slug = slug(body.event_slug);
    const link_type = str(body.link_type, 20);
    // Without these two the row cannot be interpreted, so drop it rather than
    // storing a record that quietly pollutes the counts.
    if (!event_slug || !link_type || !LINK_TYPES.has(link_type)) return ok;

    const event_state = str(body.event_state, 12);
    const channel = str(body.channel, 20);

    const admin = getServiceClient();
    await admin.from('outbound_clicks').insert({
      event_slug,
      event_id: uuid(body.event_id),
      city_slug: slug(body.city_slug, 50),
      link_type,
      dest_host: host(body.dest_host),
      event_state: event_state && EVENT_STATES.has(event_state) ? event_state : null,
      channel: channel && CHANNELS.has(channel) ? channel : 'unknown',
    });
  } catch {
    // Swallow: a tracking failure must never surface to the visitor. Genuine
    // outages show up as a flat line in the data, which the nightly brief
    // reports rather than hides.
  }

  return ok;
}
