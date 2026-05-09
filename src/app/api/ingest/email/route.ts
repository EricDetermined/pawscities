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

/**
 * POST /api/ingest/email
 *
 * Webhook handler for inbound emails (Resend, Mailgun, Cloudflare Email Routing).
 * Accepts forwarded emails, extracts URLs and content, classifies, and queues.
 *
 * Resend webhook format:
 *   { from, to, subject, text, html, headers }
 *
 * Generic format (works with most providers):
 *   { from, subject, text/body, html }
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
    const body = await request.json();

    // Normalize across email providers
    const from = body.from || body.sender || body.envelope?.from || '';
    const subject = body.subject || '';
    const textBody = body.text || body['body-plain'] || body.body || '';
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

    // Extract all URLs from subject + body
    const allText = [subject, textBody].filter(Boolean).join(' ');
    const urls = extractUrls(allText);

    // If no URLs found, still save the email as raw content
    const primaryUrl = urls[0] || null;
    const igData = primaryUrl ? parseInstagramUrl(primaryUrl) : null;

    // Simple classification
    const lower = allText.toLowerCase();
    let classification = 'other';
    if (igData?.contentType === 'profile') classification = 'influencer';
    else if (['event', 'festival', 'parade', 'walk', 'meetup', 'adoption', 'fundraiser'].some(k => lower.includes(k))) classification = 'event';
    else if (igData?.shortcode) classification = 'engagement';

    // City detection
    const cityKeywords: Record<string, string[]> = {
      paris: ['paris'], geneva: ['geneva', 'genève'], london: ['london'],
      barcelona: ['barcelona'], losangeles: ['los angeles', 'la', 'pasadena', 'hollywood'],
      nyc: ['new york', 'nyc', 'brooklyn'], sydney: ['sydney'], tokyo: ['tokyo'],
    };
    let city: string | null = null;
    for (const [c, kws] of Object.entries(cityKeywords)) {
      if (kws.some(kw => lower.includes(kw))) { city = c; break; }
    }

    // Platform detection
    let platform = 'email';
    if (primaryUrl?.includes('instagram.com')) platform = 'instagram';
    else if (primaryUrl?.includes('facebook.com')) platform = 'facebook';
    else if (primaryUrl) platform = 'website';

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

    console.log(`[EMAIL INGEST] Processed email from ${senderEmail}: ${classification} ${city || ''} (${urls.length} URLs)`);

    return NextResponse.json({
      success: true,
      id: inserted.id,
      urls_found: urls.length,
      classification,
      city,
    });
  } catch (error) {
    console.error('[EMAIL INGEST] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
