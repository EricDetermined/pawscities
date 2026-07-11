import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
import { enrichEventWithAI } from '@/lib/dalle';

export const maxDuration = 120;

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
// Handles both plain email text AND vision-enriched structured text (prefixed with "Event:", "Date:", etc.)
function parseEventFromText(rawText: string, subject: string | null): {
  name: string | null;
  description: string | null;
  venueName: string | null;
  venueAddress: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  tags: string[];
  isFree: boolean;
  externalUrl: string | null;
  sourceHandle: string | null;
} {
  const combined = [subject || '', rawText].join(' ');
  const lower = combined.toLowerCase();

  // Check for vision-enriched structured format (starts with "Event: ...")
  const isVisionEnriched = /^Event:\s/m.test(rawText);

  // ─── Event Name ────────────────────────────────────────────────────────
  let name: string | null = null;
  const eventNameMatch = rawText.match(/^Event:\s*(.+)$/m);
  if (eventNameMatch) {
    name = eventNameMatch[1].trim();
  } else if (subject && subject.length > 3 && !['events', 'event', 'fwd: event', 'fwd: events'].includes(subject.toLowerCase().trim())) {
    name = subject.replace(/^(fwd:|fw:|re:)\s*/i, '').trim();
  } else {
    const lines = rawText.split('\n').filter(l => l.trim().length > 5 && l.trim().length < 120);
    if (lines.length > 0) {
      name = lines[0].trim().replace(/^(check this|look at|here|fwd:)\s*/i, '').trim();
    }
  }

  // ─── Description ───────────────────────────────────────────────────────
  let description: string | null = null;
  const descMatch = rawText.match(/^Description:\s*(.+)$/m);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    description = rawText
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\[image:[^\]]+\]/g, '')
      .replace(/^(Event|Date|Time|Venue|Address|Source|URL|Tags|Description):\s*.+$/gm, '')
      .split('\n')
      .filter(l => l.trim().length > 10)
      .slice(0, 3)
      .join(' ')
      .substring(0, 300)
      .trim() || null;
  }

  // ─── Venue ─────────────────────────────────────────────────────────────
  let venueName: string | null = null;
  const venueMatch = rawText.match(/^Venue:\s*(.+)$/m);
  if (venueMatch) {
    venueName = venueMatch[1].trim();
  } else {
    const venuePatterns = [
      /at\s+([A-Z][A-Za-z\s&']+(?:Park|Stadium|Center|Centre|Beach|Garden|Arena|Hall|Club|Bar|Cafe|Restaurant|Brewery))/,
      /venue:\s*([^\n]+)/i,
      /location:\s*([^\n]+)/i,
    ];
    for (const pat of venuePatterns) {
      const match = combined.match(pat);
      if (match) { venueName = match[1].trim(); break; }
    }
  }

  // ─── Venue Address ─────────────────────────────────────────────────────
  let venueAddress: string | null = null;
  const addrMatch = rawText.match(/^Address:\s*(.+)$/m);
  if (addrMatch) venueAddress = addrMatch[1].trim();

  // ─── Date ──────────────────────────────────────────────────────────────
  let date: string | null = null;
  const dateLineMatch = rawText.match(/^Date:\s*(.+)$/m);
  if (dateLineMatch) {
    const dStr = dateLineMatch[1].trim();
    // Try ISO format first
    const isoMatch = dStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      date = isoMatch[1];
    } else {
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
    }
  }
  if (!date) {
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})/,
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?)/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    ];
    for (const pat of datePatterns) {
      const match = combined.match(pat);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0];
        break;
      }
    }
  }

  // ─── Time ──────────────────────────────────────────────────────────────
  let startTime: string | null = null;
  let endTime: string | null = null;
  const timeMatch = rawText.match(/^Time:\s*(.+)$/m);
  if (timeMatch) {
    const timeParts = timeMatch[1].trim().split(/\s*-\s*/);
    startTime = timeParts[0]?.trim() || null;
    endTime = timeParts[1]?.trim() || null;
    // Normalize to HH:MM:SS if needed
    if (startTime && !startTime.includes(':')) startTime = null;
    if (endTime && !endTime.includes(':')) endTime = null;
    if (startTime && startTime.length === 5) startTime += ':00';
    if (endTime && endTime.length === 5) endTime += ':00';
  }

  // ─── Source Handle ─────────────────────────────────────────────────────
  let sourceHandle: string | null = null;
  const sourceMatch = rawText.match(/^Source:\s*(@?\w+)/m);
  if (sourceMatch) sourceHandle = sourceMatch[1].trim();

  // ─── External URL ──────────────────────────────────────────────────────
  let externalUrl: string | null = null;
  const urlMatch = rawText.match(/^URL:\s*(https?:\/\/[^\s]+)/m);
  if (urlMatch) externalUrl = urlMatch[1].trim();

  // ─── Tags ──────────────────────────────────────────────────────────────
  let tags: string[] = [];
  const tagsMatch = rawText.match(/^Tags:\s*(.+)$/m);
  if (tagsMatch) {
    tags = tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  // Also add keyword-detected tags
  if (lower.includes('adoption') || lower.includes('rescue') || lower.includes('foster')) tags.push('adoption');
  if (lower.includes('walk') || lower.includes('hike') || lower.includes('park')) tags.push('outdoor');
  if (lower.includes('festival') || lower.includes('fest')) tags.push('festival');
  if (lower.includes('meetup') || lower.includes('social')) tags.push('meetup');
  if (lower.includes('sport') || lower.includes('stadium') || lower.includes('game')) tags.push('sports');
  if (lower.includes('charity') || lower.includes('fundraiser')) tags.push('charity');
  if (lower.includes('market') || lower.includes('vendor')) tags.push('market');
  tags = Array.from(new Set(tags)); // Deduplicate
  if (tags.length === 0) tags.push('community');

  // ─── Free detection ────────────────────────────────────────────────────
  const isFree = lower.includes('free') || lower.includes('no cost') || lower.includes('complimentary');

  return { name, description, venueName, venueAddress, date, startTime, endTime, tags, isFree, externalUrl, sourceHandle };
}

// Check if a handle value is an actual Instagram handle (not a system label)
const NON_HANDLES = new Set(['unknown', '@unknown', 'google_events', 'curated_scrape', 'admin', '']);
function isUsefulHandle(handle: string | null | undefined): boolean {
  if (!handle) return false;
  const clean = handle.toLowerCase().trim();
  return !NON_HANDLES.has(clean) && clean.length >= 3;
}

// Generate a URL-safe slug with random suffix to avoid duplicates
function slugify(text: string, date: string | null): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
  const suffix = Math.random().toString(36).substring(2, 6);
  return date ? `${base}-${date}-${suffix}` : `${base}-${suffix}`;
}

// Shared handler for both GET (Vercel cron) and POST (manual/inline triggers)
async function handleProcessIngest(request: NextRequest) {
  // Auth check
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: { processed: number; created: number; errors: string[] } = {
    processed: 0, created: 0, errors: [],
  };

  try {
    // Fetch pending event-classified ingest items (both 'event' and 'business_event')
    const { data: pendingItems, error: fetchError } = await supabase
      .from('ingest_queue')
      .select('*')
      .in('classification', ['event', 'business_event'])
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

    // Determine timezone from city slug
    const cityTimezones: Record<string, string> = {
      losangeles: 'America/Los_Angeles',
      newyork: 'America/New_York',
      london: 'Europe/London',
      paris: 'Europe/Paris',
      geneva: 'Europe/Zurich',
      barcelona: 'Europe/Madrid',
      sydney: 'Australia/Sydney',
      tokyo: 'Asia/Tokyo',
      atlanta: 'America/New_York',
    };

    // Non-event URL patterns — blog posts, travel guides, business listings, profiles
    const JUNK_URL_PATTERNS = [
      /agoda\.com\/travel-guides/i,
      /tripadvisor\.com/i,
      /timeout\.com.*things-to-do/i,
      /lonely\s?planet\.com/i,
      /\/travel-guides?\//i,
      /\/best-.*places/i,
      /srperro\.com\/negocios/i,    // business listings, not events
      /instagram\.com\/[^/]+\/?$/i, // IG profile pages (not posts)
      /facebook\.com\/[^/]+\/?$/i,  // FB profile pages (not events)
    ];

    for (const item of pendingItems) {
      results.processed++;

      try {
        // ─── STEP 0: URL-based junk filter ──────────────────────────────
        const itemUrl = item.url || '';
        if (itemUrl && JUNK_URL_PATTERNS.some(p => p.test(itemUrl))) {
          console.log(`[PROCESS-INGEST] Skipping non-event URL: ${itemUrl}`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'processed',
              error_message: `Non-event content (blog/guide/profile URL) — auto-rejected`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          continue;
        }

        // ─── STEP 1: Try AI enrichment first (quality gate) ──────────────
        // Uses GPT-4o-mini to extract structured data, detect language,
        // identify businesses/sponsors, and score completeness.
        // Falls back to regex-based parsing if AI is unavailable or fails.

        const aiEnriched = await enrichEventWithAI(
          item.raw_text || '',
          item.instagram_username || 'unknown',
          item.city || null,
          item.url || null,
        );

        let eventName: string | null = null;
        let eventDescription: string | null = null;
        let venueName: string | null = null;
        let venueAddress: string | null = null;
        let eventDate: string | null = null;
        let startTime: string | null = null;
        let endTime: string | null = null;
        let tags: string[] = [];
        let isFree = false;
        let externalUrl: string | null = null;
        let sourceHandle: string | null = null;
        let mentionedHandles: string[] = [];
        let qualityScore = 0;
        let qualityIssues: string[] = [];
        let localLanguageNote: string | null = null;
        let detectedCity: string | null = item.city || null;

        if (aiEnriched) {
          // AI enrichment succeeded — use structured data
          eventName = aiEnriched.name;
          eventDescription = aiEnriched.description;
          venueName = aiEnriched.venueName;
          venueAddress = aiEnriched.venueAddress;
          eventDate = aiEnriched.date;
          startTime = aiEnriched.startTime;
          endTime = aiEnriched.endTime;
          tags = aiEnriched.tags;
          isFree = aiEnriched.isFree;
          externalUrl = aiEnriched.externalUrl;
          sourceHandle = aiEnriched.sourceHandle;
          mentionedHandles = aiEnriched.mentionedHandles;
          qualityScore = aiEnriched.qualityScore;
          qualityIssues = aiEnriched.qualityIssues;
          localLanguageNote = aiEnriched.localLanguageNote;
          detectedCity = aiEnriched.city || detectedCity;

          console.log(`[PROCESS-INGEST] AI enriched "${eventName}" — quality: ${qualityScore}/100, city: ${detectedCity}, handles: ${mentionedHandles.length}`);

          // Quality gate: skip low-quality items (raised from 20 to 30)
          if (qualityScore < 30) {
            await supabase
              .from('ingest_queue')
              .update({
                status: 'needs_review',
                error_message: `Low quality score (${qualityScore}/100): ${qualityIssues.join(', ')}`,
                processed_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            results.errors.push(`${item.id}: low quality (${qualityScore})`);
            continue;
          }
        } else {
          // AI unavailable or failed — fall back to regex parsing
          console.log(`[PROCESS-INGEST] AI enrichment unavailable, using regex parser for ${item.id}`);
          const parsed = parseEventFromText(item.raw_text || '', item.subject);
          eventName = parsed.name;
          eventDescription = parsed.description;
          venueName = parsed.venueName;
          venueAddress = parsed.venueAddress;
          eventDate = parsed.date;
          startTime = parsed.startTime;
          endTime = parsed.endTime;
          tags = parsed.tags;
          isFree = parsed.isFree;
          externalUrl = parsed.externalUrl;
          sourceHandle = parsed.sourceHandle;
        }

        if (!eventName) {
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

        // ─── STEP 2: Resolve city ────────────────────────────────────────
        // Map discovery aliases (e.g. 'nyc') to database slugs (e.g. 'newyork')
        const cityAliases: Record<string, string> = {
          nyc: 'newyork',
          ny: 'newyork',
          la: 'losangeles',
          ldn: 'london',
          bcn: 'barcelona',
        };
        const resolvedCity = detectedCity
          ? (cityAliases[detectedCity] || detectedCity)
          : null;

        let cityId: string | null = null;
        if (resolvedCity && cityMap[resolvedCity]) {
          cityId = cityMap[resolvedCity].id;
        } else {
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

        // ─── STEP 3: Deduplication check (multi-layer) ────────────────────
        // Layer A: Exact normalized name match in events table
        // Layer B: Fuzzy prefix match (first 20 normalized chars)
        // Layer C: Check other ingest_queue items processed in the same batch

        const normalizedName = eventName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        const normalizedCompact = normalizedName.replace(/\s/g, '');

        // Helper: fuzzy similarity check
        function namesAreSimilar(a: string, b: string): boolean {
          if (a === b) return true;
          if (a.length < 5 || b.length < 5) return false;
          // One contains the other
          if (a.includes(b) || b.includes(a)) return true;
          // First N chars match
          const minLen = Math.min(a.length, b.length);
          const compareLen = Math.min(minLen, 20);
          if (a.substring(0, compareLen) === b.substring(0, compareLen) && compareLen >= 12) return true;
          return false;
        }

        // Search with shorter prefix for broader candidate matching
        const searchPrefix = eventName.substring(0, 25).replace(/[%_]/g, '');
        const { data: existingEvents } = await supabase
          .from('events')
          .select('id, name')
          .ilike('name', `%${searchPrefix}%`)
          .limit(15);

        const isDuplicate = existingEvents?.some(existing => {
          const existingNorm = existing.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          const existingCompact = existingNorm.replace(/\s/g, '');
          return existingCompact === normalizedCompact || namesAreSimilar(existingNorm, normalizedName);
        });

        if (isDuplicate) {
          console.log(`[PROCESS-INGEST] Skipping duplicate event "${eventName}" — similar event already exists`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'needs_review',
              error_message: `Duplicate: event "${eventName}" matches existing event in events table`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          continue;
        }

        // Also check other ingest_queue items that were already processed into events
        const { data: recentProcessed } = await supabase
          .from('ingest_queue')
          .select('id, raw_text')
          .eq('status', 'processed')
          .eq('result_action', 'event_created')
          .gte('processed_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .ilike('raw_text', `%${searchPrefix}%`)
          .limit(5);

        const isIngestDupe = recentProcessed?.some(prev => {
          const prevFirstLine = (prev.raw_text || '').split('\n')[0]?.replace(/^Event:\s*/i, '').trim() || '';
          const prevNorm = prevFirstLine.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          return namesAreSimilar(prevNorm, normalizedName);
        });

        if (isIngestDupe) {
          console.log(`[PROCESS-INGEST] Skipping ingest-queue dupe "${eventName}"`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'needs_review',
              error_message: `Duplicate: similar item already processed in ingest_queue`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          continue;
        }

        // ─── STEP 4: Create event with PENDING status ────────────────────
        // If no date could be extracted, flag for review — no more placeholder dates
        let finalDate = eventDate;
        if (!eventDate) {
          console.log(`[PROCESS-INGEST] No date for "${eventName}" (source: ${item.source}) — flagging for review`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'needs_review',
              error_message: `No event date could be extracted — needs manual date entry`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: no date extracted for "${eventName}"`);
          continue;
        }

        // Reject events with dates in the past (more than 7 days ago)
        const eventDateObj = new Date(eventDate);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (eventDateObj < sevenDaysAgo) {
          console.log(`[PROCESS-INGEST] Skipping past event "${eventName}" (${eventDate})`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'processed',
              error_message: `Past event (${eventDate}) — auto-rejected`,
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: past event "${eventName}" (${eventDate})`);
          continue;
        }

        // ─── QUALITY GATE: require a way for users to find more details ──────────
        // An event is only worth posting if a user can learn more from it — i.e. it
        // has EITHER a real official/details link OR a social handle. If it has
        // neither, sending people to Paw Cities for details we don't have is a dead
        // end, so auto-reject it here (never enters the events table / posting queue).
        const resolvedHandle = isUsefulHandle(sourceHandle)
          ? sourceHandle
          : (isUsefulHandle(item.instagram_username) ? item.instagram_username : null);
        const hasHandle = !!resolvedHandle || (mentionedHandles && mentionedHandles.length > 0);
        const candidateUrl = (externalUrl || item.url || '').trim();
        // A synthesized Google-search fallback isn't a real details page.
        const hasRealLink = candidateUrl.length > 0 && !/google\.[a-z.]+\/search/i.test(candidateUrl);
        if (!hasHandle && !hasRealLink) {
          console.log(`[PROCESS-INGEST] Auto-rejecting "${eventName}" — no official link and no social handle (nowhere for users to find details)`);
          await supabase
            .from('ingest_queue')
            .update({
              status: 'processed',
              result_action: 'auto_rejected_no_source',
              error_message: 'No official link or social handle — auto-rejected (users would have nowhere to find event details)',
              processed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
          results.errors.push(`${item.id}: no link/handle for "${eventName}" — auto-rejected`);
          continue;
        }

        const eventSlug = slugify(eventName, finalDate);
        const timezone = (detectedCity && cityTimezones[detectedCity]) || 'America/Los_Angeles';

        // Build description with local language note
        let fullDescription = eventDescription || '';
        if (localLanguageNote) fullDescription += `\n\n${localLanguageNote}`;
        if (!fullDescription.trim()) fullDescription = null as unknown as string;

        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            city_id: cityId,
            name: eventName,
            slug: eventSlug,
            description: fullDescription,
            venue_name: venueName,
            venue_address: venueAddress,
            start_date: finalDate,
            start_time: startTime || null,
            end_time: endTime || null,
            external_url: externalUrl || item.url,
            timezone,
            tags,
            is_free: isFree,
            is_featured: false,
            status: 'PENDING',
            source: item.submitted_by === 'cron:event-discovery' ? 'discovery_agent' : 'admin',
            submitter_email: item.submitted_by,
            source_post_url: item.url,
            source_handle: isUsefulHandle(sourceHandle) ? sourceHandle : (isUsefulHandle(item.instagram_username) ? item.instagram_username : null),
            mentioned_handles: mentionedHandles.length > 0 ? mentionedHandles : null,
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
        const handleInfo = mentionedHandles.length > 0 ? ` [handles: @${mentionedHandles.slice(0, 3).join(', @')}]` : '';
        console.log(`[PROCESS-INGEST] Created event "${eventName}" (${newEvent.id}) — quality: ${qualityScore}/100, city: ${detectedCity}${handleInfo}`);
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

// GET handler — used by Vercel cron (crons always send GET)
export async function GET(request: NextRequest) {
  return handleProcessIngest(request);
}

// POST handler — used by inline triggers (e.g., after email ingest)
export async function POST(request: NextRequest) {
  return handleProcessIngest(request);
}
