import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function getCronSecret() { return process.env.CRON_SECRET; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── URL extraction ─────────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return (text.match(urlRegex) || []).map(u => u.replace(/[.,;:!?)]+$/, ''));
}

function parseInstagramUrl(url: string): { shortcode?: string; username?: string; contentType: string } | null {
  try {
    let cleaned = url.trim();
    if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`;
    const parsed = new URL(cleaned);
    if (!parsed.hostname.includes('instagram.com')) return null;

    const segments = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

    if (segments[0] === 'p' && segments[1]) return { shortcode: segments[1], contentType: 'post' };
    if (segments[0] === 'reel' && segments[1]) return { shortcode: segments[1], contentType: 'reel' };
    if (segments[0] === 'stories' && segments[1]) return { username: segments[1], contentType: 'story' };
    if (segments.length === 1) {
      const username = segments[0].replace(/^@/, '');
      if (!['explore', 'reels', 'direct', 'accounts'].includes(username)) {
        return { username, contentType: 'profile' };
      }
    }
    return { contentType: 'unknown' };
  } catch {
    return null;
  }
}

// ─── Vision AI: extract event details from screenshot ────────────────────────

interface ExtractedEventData {
  event_name: string | null;
  date: string | null;           // ISO format YYYY-MM-DD
  start_time: string | null;     // HH:MM
  end_time: string | null;       // HH:MM
  venue_name: string | null;
  venue_address: string | null;
  description: string | null;
  source_handle: string | null;  // Instagram @handle
  external_url: string | null;   // Registration/ticket URL
  tags: string[];
  city: string | null;           // city slug
  is_free: boolean;
  raw_text_summary: string;      // Full text extraction for downstream processing
}

const VISION_PROMPT = `You are an event data extractor for PawCities, a dog-friendly city guide.
Analyze this screenshot (typically from an Instagram post or story) and extract all event details.

Return ONLY valid JSON with these fields:
{
  "event_name": "Full event name",
  "date": "YYYY-MM-DD or null if unclear",
  "start_time": "HH:MM (24h) or null",
  "end_time": "HH:MM (24h) or null",
  "venue_name": "Venue/location name or null",
  "venue_address": "Street address or area or null",
  "description": "Brief 1-2 sentence description of the event",
  "source_handle": "@instagram_handle of the poster or null",
  "external_url": "Any registration/ticket URL visible or null",
  "tags": ["relevant", "tags"],
  "city": "city slug from: paris, geneva, london, barcelona, losangeles, nyc, sydney, tokyo — or null",
  "is_free": true/false,
  "raw_text_summary": "All readable text from the image transcribed as a paragraph for search/classification"
}

Important:
- For dates, assume the current year is 2026 unless specified otherwise
- Tags should be lowercase, from: adoption, outdoor, festival, meetup, sports, charity, market, community, dog-walking, pack-walk, brunch, fundraiser, wellness
- The city slug for Los Angeles area (DTLA, Pasadena, Hollywood, etc.) is "losangeles"
- Extract Instagram handles visible in the image (poster @handle)
- If the image shows an Instagram post, note the account name as source_handle
- Transcribe ALL visible text into raw_text_summary for downstream processing`;

async function extractEventFromImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<ExtractedEventData | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[EMAIL INGEST] ANTHROPIC_API_KEY not configured — skipping vision processing');
    return null;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract JSON from response
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Parse JSON — handle markdown code fences
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const parsed = JSON.parse(jsonMatch[1]!.trim()) as ExtractedEventData;

    console.log(`[EMAIL INGEST] Vision extracted: "${parsed.event_name}" on ${parsed.date} at ${parsed.venue_name}`);
    return parsed;
  } catch (error) {
    console.error('[EMAIL INGEST] Vision extraction failed:', error);
    return null;
  }
}

// Extract image attachments from email payload
function getImageAttachments(body: Record<string, unknown>): Array<{
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  filename: string;
}> {
  const images: Array<{
    base64: string;
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    filename: string;
  }> = [];

  // Resend format: attachments array with { filename, content_type, content (base64) }
  const attachments = (body.attachments || []) as Array<{
    filename?: string;
    content_type?: string;
    contentType?: string;
    content?: string;
    data?: string;
  }>;

  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  for (const att of attachments) {
    const contentType = (att.content_type || att.contentType || '').toLowerCase();
    const base64Data = att.content || att.data || '';

    if (validImageTypes.includes(contentType) && base64Data) {
      images.push({
        base64: base64Data.replace(/^data:image\/\w+;base64,/, ''), // Strip data URI prefix if present
        mediaType: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        filename: att.filename || 'attachment.jpg',
      });
    }
  }

  // Also check for inline images embedded as base64 data URIs in HTML
  if (typeof body.html === 'string') {
    const dataUriRegex = /data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)/g;
    let match;
    while ((match = dataUriRegex.exec(body.html as string)) !== null) {
      if (match[2].length > 1000) { // Skip tiny icons/tracking pixels
        images.push({
          base64: match[2],
          mediaType: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          filename: `inline-image-${images.length}.${match[1].split('/')[1]}`,
        });
      }
    }
  }

  return images;
}

/**
 * POST /api/ingest/email
 *
 * Webhook handler for inbound emails (Resend).
 * Accepts forwarded emails, extracts URLs and content, classifies, and queues.
 * Now with Vision AI: reads screenshot attachments to extract event details.
 *
 * Resend webhook format:
 *   { type: "email.received", data: { from, to, subject, text, html, attachments } }
 *
 * Auth: webhook secret in query string or X-Webhook-Secret header
 */
export async function POST(request: NextRequest) {
  // Authenticate — check query param or header
  const webhookSecret = request.nextUrl.searchParams.get('secret')
    || request.headers.get('x-webhook-secret');
  const cronSecret = getCronSecret();

  if (cronSecret && webhookSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawBody = await request.json();

    // Resend webhook wraps email data in { type: "email.received", data: { ... } }
    const body = rawBody.data && rawBody.type === 'email.received' ? rawBody.data : rawBody;

    // Debug: log top-level keys and attachment info to diagnose what Resend sends
    const bodyKeys = Object.keys(body);
    const attachmentInfo = Array.isArray(body.attachments)
      ? `${body.attachments.length} items: ${(body.attachments as Array<Record<string, unknown>>).map(a => `${a.filename || a.name || 'unnamed'}(${a.content_type || a.contentType || a.type || 'unknown'}, ${typeof a.content === 'string' ? a.content.length : 0} chars)`).join(', ')}`
      : `no attachments field (keys: ${bodyKeys.join(', ')})`;
    console.log(`[EMAIL INGEST] Payload keys: [${bodyKeys.join(', ')}] | Attachments: ${attachmentInfo}`);

    // Normalize across email providers
    const from = body.from || body.sender || body.envelope?.from || '';
    const subject = body.subject || '';
    let textBody = body.text || body['body-plain'] || body.body || '';
    const htmlBody = body.html || body['body-html'] || '';

    // Extract sender email
    const senderEmail = typeof from === 'string'
      ? (from.match(/<([^>]+)>/))?.[1] || from
      : from.address || from.email || String(from);

    // Security: only accept from known admin emails
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0 && !adminEmails.includes(senderEmail.toLowerCase())) {
      console.log(`[EMAIL INGEST] Rejected email from unknown sender: ${senderEmail}`);
      return NextResponse.json({ message: 'Accepted' }); // Return 200 to avoid retries
    }

    // ─── Vision AI: process image attachments ──────────────────────────────
    const imageAttachments = getImageAttachments(body);
    let visionData: ExtractedEventData | null = null;

    if (imageAttachments.length > 0) {
      console.log(`[EMAIL INGEST] Found ${imageAttachments.length} image attachment(s) — running vision extraction`);

      // Process the first (primary) image — usually the screenshot
      const primaryImage = imageAttachments[0];
      visionData = await extractEventFromImage(primaryImage.base64, primaryImage.mediaType);

      if (visionData) {
        // Enrich textBody with AI-extracted content so downstream processing works
        const enrichedParts = [
          visionData.event_name ? `Event: ${visionData.event_name}` : '',
          visionData.date ? `Date: ${visionData.date}` : '',
          visionData.start_time ? `Time: ${visionData.start_time}${visionData.end_time ? ` - ${visionData.end_time}` : ''}` : '',
          visionData.venue_name ? `Venue: ${visionData.venue_name}` : '',
          visionData.venue_address ? `Address: ${visionData.venue_address}` : '',
          visionData.description ? `Description: ${visionData.description}` : '',
          visionData.source_handle ? `Source: ${visionData.source_handle}` : '',
          visionData.external_url ? `URL: ${visionData.external_url}` : '',
          visionData.tags.length > 0 ? `Tags: ${visionData.tags.join(', ')}` : '',
          '',
          visionData.raw_text_summary || '',
        ].filter(Boolean).join('\n');

        // Prepend AI-extracted text to existing body
        textBody = enrichedParts + (textBody ? `\n\n--- Original email text ---\n${textBody}` : '');
        console.log(`[EMAIL INGEST] Vision enriched text body (${textBody.length} chars)`);
      }
    }

    // Extract all URLs from subject + body (now includes AI-extracted URLs)
    const allText = [subject, textBody].filter(Boolean).join(' ');
    const urls = extractUrls(allText);

    // If no URLs found, still save the email as raw content
    const primaryUrl = visionData?.external_url || urls[0] || null;
    const igData = primaryUrl ? parseInstagramUrl(primaryUrl) : null;

    // Classification — vision data takes priority
    const lower = allText.toLowerCase();
    let classification = 'other';
    if (visionData?.event_name) {
      classification = 'event'; // If vision found an event, it's an event
    } else if (igData?.contentType === 'profile') {
      classification = 'influencer';
    } else if (['event', 'festival', 'parade', 'walk', 'meetup', 'adoption', 'fundraiser'].some(k => lower.includes(k))) {
      classification = 'event';
    } else if (igData?.shortcode) {
      classification = 'engagement';
    }

    // City detection — vision data takes priority
    let city: string | null = visionData?.city || null;
    if (!city) {
      const cityKeywords: Record<string, string[]> = {
        paris: ['paris'], geneva: ['geneva', 'genève'], london: ['london'],
        barcelona: ['barcelona'], losangeles: ['los angeles', 'la', 'pasadena', 'hollywood', 'dtla'],
        nyc: ['new york', 'nyc', 'brooklyn'], sydney: ['sydney'], tokyo: ['tokyo'],
      };
      for (const [c, kws] of Object.entries(cityKeywords)) {
        if (kws.some(kw => lower.includes(kw))) { city = c; break; }
      }
    }

    // Platform detection
    let platform = 'email';
    if (visionData?.source_handle) platform = 'instagram'; // Screenshot of IG post
    else if (primaryUrl?.includes('instagram.com')) platform = 'instagram';
    else if (primaryUrl?.includes('facebook.com')) platform = 'facebook';
    else if (primaryUrl) platform = 'website';

    // Instagram handle from vision
    const igUsername = visionData?.source_handle?.replace(/^@/, '') || igData?.username || null;

    // Insert into ingest_queue
    const supabase = getSupabaseAdmin();
    const { data: inserted, error: insertError } = await supabase
      .from('ingest_queue')
      .insert({
        source: 'email',
        submitted_by: senderEmail,
        url: primaryUrl,
        raw_text: textBody.substring(0, 5000), // cap at 5k chars
        subject: subject.substring(0, 500),
        platform,
        content_type: igData?.contentType || (visionData ? 'post' : null),
        instagram_shortcode: igData?.shortcode || null,
        instagram_username: igUsername,
        classification,
        city,
        priority: classification === 'event' ? 'high' : 'normal',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[EMAIL INGEST] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    // If there were multiple URLs, insert additional items for each
    if (urls.length > 1) {
      const additionalItems = urls.slice(1).map(u => {
        const ig = parseInstagramUrl(u);
        return {
          source: 'email' as const,
          submitted_by: senderEmail,
          url: u,
          raw_text: null,
          subject: `Additional URL from: ${subject}`.substring(0, 500),
          platform: u.includes('instagram.com') ? 'instagram' : 'website',
          content_type: ig?.contentType || null,
          instagram_shortcode: ig?.shortcode || null,
          instagram_username: ig?.username || null,
          classification: ig?.contentType === 'profile' ? 'influencer' : 'engagement',
          city,
          priority: 'normal' as const,
          status: 'pending' as const,
        };
      });

      if (additionalItems.length > 0) {
        await supabase.from('ingest_queue').insert(additionalItems);
      }
    }

    console.log(`[EMAIL INGEST] Processed email from ${senderEmail}: ${classification} ${city || ''} (${urls.length} URLs, ${imageAttachments.length} images, vision: ${!!visionData})`);

    // Auto-process event items immediately
    let autoProcessed = false;
    if (classification === 'event') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pawcities.com';
        const processRes = await fetch(`${baseUrl}/api/cron/process-ingest?secret=${cronSecret}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (processRes.ok) {
          const processResult = await processRes.json();
          autoProcessed = processResult.created > 0;
          console.log(`[EMAIL INGEST] Auto-processed: ${processResult.created} events created`);
        }
      } catch (e) {
        console.error('[EMAIL INGEST] Auto-process failed (non-blocking):', e);
      }
    }

    return NextResponse.json({
      success: true,
      id: inserted.id,
      urls_found: urls.length,
      images_found: imageAttachments.length,
      vision_extracted: !!visionData,
      classification,
      city,
      auto_processed: autoProcessed,
    });
  } catch (error) {
    console.error('[EMAIL INGEST] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
