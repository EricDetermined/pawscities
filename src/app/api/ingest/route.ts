import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getCronSecret() { return process.env.CRON_SECRET; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── Instagram URL parsing ──────────────────────────────────────────────────

interface ParsedInstagram {
  shortcode?: string;
  username?: string;
  contentType: 'post' | 'reel' | 'story' | 'profile' | 'unknown';
}

function parseInstagramUrl(url: string): ParsedInstagram | null {
  try {
    // Normalize the URL
    let cleaned = url.trim();
    if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`;
    const parsed = new URL(cleaned);

    // Must be instagram.com
    if (!parsed.hostname.includes('instagram.com')) return null;

    const path = parsed.pathname.replace(/\/+$/, ''); // strip trailing slash
    const segments = path.split('/').filter(Boolean);

    // /p/SHORTCODE or /reel/SHORTCODE
    if (segments[0] === 'p' && segments[1]) {
      return { shortcode: segments[1], contentType: 'post' };
    }
    if (segments[0] === 'reel' && segments[1]) {
      return { shortcode: segments[1], contentType: 'reel' };
    }

    // /stories/USERNAME/ID
    if (segments[0] === 'stories' && segments[1]) {
      return { username: segments[1], contentType: 'story' };
    }

    // /@USERNAME or /USERNAME (profile)
    if (segments.length === 1) {
      const username = segments[0].replace(/^@/, '');
      // Skip known non-profile paths
      if (!['explore', 'reels', 'direct', 'accounts', 'about'].includes(username)) {
        return { username, contentType: 'profile' };
      }
    }

    return { contentType: 'unknown' };
  } catch {
    return null;
  }
}

// ─── URL extraction from text ───────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return (text.match(urlRegex) || []).map(u => u.replace(/[.,;:!?)]+$/, '')); // strip trailing punctuation
}

// ─── City classification ────────────────────────────────────────────────────

const CITY_KEYWORDS: Record<string, string[]> = {
  paris: ['paris', 'france', 'french', 'parisien'],
  geneva: ['geneva', 'geneve', 'genève', 'switzerland', 'swiss', 'suisse'],
  london: ['london', 'uk', 'british', 'england'],
  barcelona: ['barcelona', 'spain', 'spanish', 'catalonia', 'españa'],
  losangeles: ['los angeles', 'la', 'hollywood', 'pasadena', 'venice beach', 'santa monica', 'marina del rey', 'dodger', 'lakers'],
  nyc: ['new york', 'nyc', 'brooklyn', 'manhattan', 'queens', 'bronx', 'staten island'],
  sydney: ['sydney', 'australia', 'australian', 'bondi', 'nsw'],
  tokyo: ['tokyo', 'japan', 'japanese', 'shibuya', 'shinjuku', '東京'],
};

function classifyCity(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [city, keywords] of Object.entries(CITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return city;
    }
  }
  return null;
}

// ─── Content classification ─────────────────────────────────────────────────

const EVENT_KEYWORDS = [
  'event', 'festival', 'parade', 'walk', 'meetup', 'meet-up', 'adoption',
  'fundraiser', 'charity', 'expo', 'fair', 'market', 'concert', 'show',
  'woofstock', 'pupchella', 'dog day', 'pet night', 'yappy hour',
  'bark', 'paws', 'rescue', 'shelter', 'date:', 'tickets', 'rsvp',
  'this saturday', 'this sunday', 'this weekend', 'join us', 'come out',
];

const INFLUENCER_KEYWORDS = [
  'collab', 'partner', 'ambassador', 'influencer', 'creator',
  'dm for', 'link in bio', 'sponsored', 'gifted',
];

function classifyContent(text: string, igData?: ParsedInstagram | null): string {
  const lower = text.toLowerCase();

  // Profile links → influencer
  if (igData?.contentType === 'profile') return 'influencer';

  // Event keywords
  if (EVENT_KEYWORDS.some(kw => lower.includes(kw))) return 'event';

  // Influencer keywords
  if (INFLUENCER_KEYWORDS.some(kw => lower.includes(kw))) return 'influencer';

  // Instagram posts default to engagement opportunity
  if (igData?.shortcode) return 'engagement';

  return 'other';
}

// ─── POST /api/ingest ───────────────────────────────────────────────────────

/**
 * Unified ingest endpoint for iOS Share Sheet, email, and manual submissions.
 *
 * Accepts:
 *   POST /api/ingest
 *   Body: { url, text, subject, source }
 *   Auth: Bearer CRON_SECRET or ?secret= param
 *
 * The iOS Shortcut sends: { url: "https://instagram.com/p/...", source: "share_sheet" }
 * Email ingest sends:     { url: "...", text: "email body", subject: "...", source: "email", submitted_by: "sender@..." }
 * Manual (admin) sends:   { url: "...", text: "notes", source: "manual" }
 */
export async function POST(request: NextRequest) {
  // Authenticate
  const authHeader = request.headers.get('authorization');
  const cronSecret = getCronSecret();

  if (cronSecret) {
    const bearerMatch = authHeader === `Bearer ${cronSecret}`;
    if (!bearerMatch) {
      // Also check body for secret (iOS Shortcuts can't easily set headers)
      try {
        const cloned = request.clone();
        const body = await cloned.json();
        if (body.secret !== cronSecret) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  try {
    const body = await request.json();
    const { url, text, subject, source = 'manual', submitted_by } = body;

    if (!url && !text) {
      return NextResponse.json({ error: 'Provide at least a url or text' }, { status: 400 });
    }

    // Extract and parse URLs
    const allText = [url, text, subject].filter(Boolean).join(' ');
    const urls = url ? [url, ...extractUrls(text || '')] : extractUrls(allText);
    const primaryUrl = urls[0] || null;

    // Parse Instagram data
    const igData = primaryUrl ? parseInstagramUrl(primaryUrl) : null;

    // Classify
    const classification = classifyContent(allText, igData);
    const city = classifyCity(allText);

    // Determine platform
    let platform = 'unknown';
    if (primaryUrl?.includes('instagram.com')) platform = 'instagram';
    else if (primaryUrl?.includes('facebook.com')) platform = 'facebook';
    else if (primaryUrl?.includes('tiktok.com')) platform = 'tiktok';
    else if (primaryUrl) platform = 'website';
    else platform = 'text';

    // Insert into ingest_queue
    const supabase = getSupabaseAdmin();
    const { data: inserted, error: insertError } = await supabase
      .from('ingest_queue')
      .insert({
        source,
        submitted_by: submitted_by || (source === 'share_sheet' ? 'ios_shortcut' : null),
        url: primaryUrl,
        raw_text: text || null,
        subject: subject || null,
        platform,
        content_type: igData?.contentType || null,
        instagram_shortcode: igData?.shortcode || null,
        instagram_username: igData?.username || null,
        classification,
        city,
        priority: classification === 'event' ? 'high' : 'normal',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[INGEST] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    // Return a short confirmation (iOS Shortcuts will show this)
    const emoji: Record<string, string> = {
      event: '📅', engagement: '💬', influencer: '👤',
      repost: '🔄', partnership: '🤝', other: '📌',
    };

    return NextResponse.json({
      success: true,
      id: inserted.id,
      classification,
      city: city || 'unmatched',
      platform,
      message: `${emoji[classification] || '📌'} Captured as ${classification}${city ? ` in ${city}` : ''}`,
    });
  } catch (error) {
    console.error('[INGEST] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── GET /api/ingest — list pending items ───────────────────────────────────

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const cronSecret = getCronSecret();
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const status = request.nextUrl.searchParams.get('status') || 'pending';

  const { data, error } = await supabase
    .from('ingest_queue')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data || [],
    count: data?.length || 0,
    status,
  });
}
