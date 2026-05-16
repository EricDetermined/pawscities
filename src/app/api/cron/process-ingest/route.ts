import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/cron/process-ingest
 *
 * Auto-processes pending ingest_queue items classified as "event".
 * Creates event rows with status PENDING so they appear in admin dashboard for review.
 *
 * Can be triggered:
 *   1. By Vercel cron (daily)
 *   2. Inline after email ingest creates an event-classified item
 *   3. Manually via admin
 *
 * Auth: CRON_SECRET in Authorization header or query param
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// City slug → city_id mapping (loaded dynamically)
async function getCityMap(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase.from('cities').select('id, slug, name');
  const map: Record<string, { id: string; name: string }> = {};
  if (data) {
    for (const city of data) {
      map[city.slug] = { id: city.id, name: city.name };
    }
  }
  return map;
}

// Extract event details from raw_text using pattern matching
function parseEventFromText(rawText: string, subject: string | null): {
  name: string | null;
  description: string | null;
  venueName: string | null;
  date: string | null;
  tags: string[];
  isFree: boolean;
} {
  const combined = [subject || '', rawText].join(' ');
  const lower = combined.toLowerCase();

  // Try to extract event name from subject or first meaningful line
  let name: string | null = null;
  if (subject && subject.length > 3 && subject.toLowerCase() !== 'events') {
    name = subject;
  } else {
    // First non-empty line that looks like a title
    const lines = rawText.split('\n').filter(l => l.trim().length > 5 && l.trim().length < 120);
    if (lines.length > 0) {
      name = lines[0].trim().replace(/^(check this|look at|here|fwd:)\s*/i, '').trim();
    }
  }

  // Description: first 300 chars of meaningful text
  const description = rawText
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\[image:[^\]]+\]/g, '')
    .split('\n')
    .filter(l => l.trim().length > 10)
    .slice(0, 3)
    .join(' ')
    .substring(0, 300)
    .trim() || null;

  // Venue detection
  let venueName: string | null = null;
  const venuePatterns = [
    /at\s+([A-Z][A-Za-z\s&']+(?:Park|Stadium|Center|Centre|Beach|Garden|Arena|Hall|Club|Bar|Cafe|Restaurant|Brewery))/,
    /venue:\s*([^\n]+)/i,
    /location:\s*([^\n]+)/i,
  ];
  for (const pat of venuePatterns) {
    const match = combined.match(pat);
    if (match) { venueName = match[1].trim(); break; }
  }

  // Date detection
  let date: string | null = null;
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?)/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];
  for (const pat of datePatterns) {
    const match = combined.match(pat);
    if (match) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split('T')[0];
      }
      break;
    }
  }

  // Tags
  const tags: string[] = [];
  if (lower.includes('adoption') || lower.includes('rescue') || lower.includes('foster')) tags.push('adoption');
  if (lower.includes('walk') || lower.includes('hike') || lower.includes('park')) tags.push('outdoor');
  if (lower.includes('festival') || lower.includes('fest')) tags.push('festival');
  if (lower.includes('meetup') || lower.includes('social')) tags.push('meetup');
  if (lower.includes('sport') || lower.includes('stadium') || lower.includes('game')) tags.push('sports');
  if (lower.includes('charity') || lower.includes('fundraiser')) tags.push('charity');
  if (lower.includes('market') || lower.includes('vendor')) tags.push('market');
  if (tags.length === 0) tags.push('community');

  // Free detection
  const isFree = lower.includes('free') || lower.includes('no cost') || lower.includes('complimentary');

  return { name, description, venueName, date, tags, isFree };
}

// Generate a URL-safe slug
function slugify(text: string, date: string | null): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
  return date ? `${base}-${date}` : base;
}

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const provided = authHeader?.replace('Bearer ', '') || querySecret;
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const results: { processed: number; created: number; errors: string[] } = {
    processed: 0, created: 0, errors: [],
  };

  try {
    // Fetch pending event-classified ingest items
    const { data: pendingItems, error: fetchError } = await supabase
      .from('ingest_queue')
      .select('*')
      .eq('classification', 'event')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingItems || pendingItems.length === 0) {
      return NextResponse.json({ message: 'No pending event items', ...results });
    }

    // Load city mapping
    const cityMap = await getCityMap(supabase);

    for (const item of pendingItems) {
      results.processed++;

      try {
        // Parse event details from raw text
        const parsed = parseEventFromText(item.raw_text || '', item.subject);

        if (!parsed.name) {
          // Can't create event without a name — mark for manual review
          await supabase
            .from('ingest_queue')
            .update({
              status: 'needs_review',
              error_message: 'Could not extract event name from content',
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: no event name extracted`);
          continue;
        }

        // Resolve city
        let cityId: string | null = null;
        if (item.city && cityMap[item.city]) {
          cityId = cityMap[item.city].id;
        } else {
          // Default to Los Angeles if no city detected
          cityId = cityMap['losangeles']?.id || null;
        }

        if (!cityId) {
          await supabase
            .from('ingest_queue')
            .update({
              status: 'needs_review',
              error_message: 'Could not resolve city',
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: no city resolved`);
          continue;
        }

        // Create the event with PENDING status for admin review
        const eventSlug = slugify(parsed.name, parsed.date);
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            city_id: cityId,
            name: parsed.name,
            slug: eventSlug,
            description: parsed.description,
            venue_name: parsed.venueName,
            start_date: parsed.date || null,
            timezone: 'America/Los_Angeles',
            tags: parsed.tags,
            is_free: parsed.isFree,
            is_featured: false,
            status: 'PENDING',
            source: 'admin', // valid enum value
            submitter_email: item.submitted_by,
            source_post_url: item.url,
            source_handle: item.instagram_username,
          })
          .select('id')
          .single();

        if (insertError) {
          await supabase
            .from('ingest_queue')
            .update({
              status: 'error',
              error_message: insertError.message,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: ${insertError.message}`);
          continue;
        }

        // Mark ingest item as processed
        await supabase
          .from('ingest_queue')
          .update({
            status: 'processed',
            result_action: 'event_created',
            result_id: newEvent.id,
            processed_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        results.created++;
        console.log(`[PROCESS-INGEST] Created event "${parsed.name}" (${newEvent.id}) from ingest ${item.id}`);
      } catch (itemError) {
        results.errors.push(`${item.id}: ${String(itemError)}`);
      }
    }

    console.log(`[PROCESS-INGEST] Done: ${results.created} events created from ${results.processed} items`);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[PROCESS-INGEST] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
