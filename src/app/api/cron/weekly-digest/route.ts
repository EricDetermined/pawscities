import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { verifyCronAuth } from '@/lib/cron-auth';

// ─── Config ────────────────────────────────────────────────────────────────────
function getAppUrl() { return process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com'; }

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

// ─── City name mapping ─────────────────────────────────────────────────────────

const CITY_NAMES: Record<string, string> = {
  paris: 'Paris', geneva: 'Geneva', london: 'London', barcelona: 'Barcelona',
  losangeles: 'Los Angeles', newyork: 'New York City', sydney: 'Sydney', tokyo: 'Tokyo',
  atlanta: 'Atlanta',
};

// ─── Email Template ────────────────────────────────────────────────────────────

interface DigestData {
  cityName: string;
  citySlug: string;
  events: { name: string; date: string; venue: string | null; isFree: boolean }[];
  newEstablishments: { name: string; category: string }[];
  tip: { headline: string; body: string; city: string } | null;
}

function buildDigestEmail(data: DigestData, unsubscribeToken: string): string {
  const appUrl = getAppUrl();

  const eventsHtml = data.events.length > 0
    ? data.events.slice(0, 5).map(e => `
        <tr><td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
          <strong style="color:#1a1a1a;">${e.name}</strong>
          ${e.isFree ? '<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;padding:1px 6px;border-radius:4px;margin-left:6px;">Free</span>' : ''}
          <br/><span style="font-size:13px;color:#6b7280;">${e.date}${e.venue ? ` · ${e.venue}` : ''}</span>
        </td></tr>`).join('')
    : '<tr><td style="padding:12px 16px;color:#9ca3af;font-size:14px;">No upcoming events this week. Check back soon!</td></tr>';

  const spotsHtml = data.newEstablishments.length > 0
    ? data.newEstablishments.slice(0, 3).map(e => `
        <tr><td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;">
          <strong>${e.name}</strong> <span style="color:#9ca3af;font-size:12px;">(${e.category})</span>
        </td></tr>`).join('')
    : '';

  const tipHtml = data.tip
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;">
        <strong style="color:#c2410c;">${data.tip.headline}</strong>
        <p style="margin:6px 0 0;font-size:14px;color:#4a4a4a;">${data.tip.body}</p>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f4f0;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background-color:#ea580c;padding:24px 32px;">
  <span style="font-size:22px;font-weight:700;color:#ffffff;">&#128062; Paw Cities Weekly</span>
  <br/><span style="font-size:14px;color:#ffffff;opacity:0.9;">Your ${data.cityName} dog-friendly digest</span>
</td></tr>

<!-- Events Section -->
<tr><td style="padding:24px 32px 0;">
  <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">Upcoming Events in ${data.cityName}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:14px;">
    ${eventsHtml}
  </table>
  <table cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td>
    <a href="${appUrl}/${data.citySlug}#events" style="display:inline-block;padding:10px 24px;background-color:#ea580c;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">See All Events</a>
  </td></tr></table>
</td></tr>

${data.newEstablishments.length > 0 ? `
<!-- New Spots -->
<tr><td style="padding:16px 32px 0;">
  <h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a;">New Dog-Friendly Spots</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;font-size:14px;">
    ${spotsHtml}
  </table>
</td></tr>` : ''}

<!-- Tip of the Week -->
<tr><td style="padding:16px 32px;">
  <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1a1a1a;">Tip of the Week</h2>
  ${tipHtml || '<p style="font-size:14px;color:#6b7280;">Check back next week for a fresh tip!</p>'}
</td></tr>

<!-- Share CTA -->
<tr><td style="padding:0 32px 24px;">
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;text-align:center;">
    <strong style="color:#0369a1;">Know a dog lover?</strong>
    <p style="margin:4px 0 0;font-size:13px;color:#4a4a4a;">Forward this email — they can subscribe at <a href="${appUrl}" style="color:#ea580c;text-decoration:none;">pawcities.com</a></p>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;background-color:#fef3e8;border-top:1px solid #fed7aa;">
  <p style="margin:0;font-size:13px;color:#9a7b5a;">Paw Cities &mdash; Dog-Friendly Places Worldwide</p>
  <p style="margin:4px 0 0;font-size:12px;color:#b89b78;">
    <a href="${appUrl}" style="color:#ea580c;text-decoration:none;">pawcities.com</a>
    &nbsp;&middot;&nbsp;
    <a href="${appUrl}/api/subscribe?unsubscribe=${unsubscribeToken}" style="color:#b89b78;text-decoration:underline;">Unsubscribe</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── GET handler ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const resend = getResend();
  if (!supabase || !resend) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  console.log('[WEEKLY DIGEST] Starting...');

  // 1. Get all active subscribers
  const { data: subscribers, error: subError } = await supabase
    .from('subscribers')
    .select('id, email, city_slug, unsubscribe_token')
    .eq('status', 'active')
    .eq('weekly_digest', true);

  if (subError || !subscribers) {
    console.error('[WEEKLY DIGEST] Failed to fetch subscribers:', subError);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }

  if (subscribers.length === 0) {
    console.log('[WEEKLY DIGEST] No active subscribers — skipping');
    return NextResponse.json({ message: 'No subscribers', sent: 0 });
  }

  console.log(`[WEEKLY DIGEST] ${subscribers.length} active subscribers`);

  // 2. Get upcoming events (next 14 days) grouped by city
  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { data: events } = await supabase
    .from('events')
    .select('name, start_date, venue_name, is_free, city_id, cities!inner(slug)')
    .eq('status', 'APPROVED')
    .gte('start_date', now.toISOString().split('T')[0])
    .lte('start_date', twoWeeksOut.toISOString().split('T')[0])
    .order('start_date', { ascending: true })
    .limit(50);

  // Group events by city slug
  const eventsByCity: Record<string, { name: string; date: string; venue: string | null; isFree: boolean }[]> = {};
  for (const event of (events || [])) {
    const citySlug = (event.cities as unknown as { slug: string })?.slug || 'unknown';
    if (!eventsByCity[citySlug]) eventsByCity[citySlug] = [];
    const d = new Date(event.start_date + 'T00:00:00');
    eventsByCity[citySlug].push({
      name: event.name,
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      venue: event.venue_name,
      isFree: event.is_free,
    });
  }

  // 3. Get recently added establishments (last 7 days)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: newSpots } = await supabase
    .from('establishments')
    .select('name, categories!inner(name), cities!inner(slug)')
    .eq('status', 'ACTIVE')
    .gte('created_at', oneWeekAgo.toISOString())
    .limit(20);

  const spotsByCity: Record<string, { name: string; category: string }[]> = {};
  for (const spot of (newSpots || [])) {
    const citySlug = (spot.cities as unknown as { slug: string })?.slug || 'unknown';
    if (!spotsByCity[citySlug]) spotsByCity[citySlug] = [];
    spotsByCity[citySlug].push({
      name: spot.name,
      category: (spot.categories as unknown as { name: string })?.name || 'Other',
    });
  }

  // 4. Pick a rotating tip from the content bank (simple hash on week number)
  const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

  // 5. Send personalized email to each subscriber
  let sent = 0;
  let failed = 0;

  // Batch by city for efficiency
  const allCitySlugs = [...new Set(subscribers.map(s => s.city_slug || 'losangeles'))];

  for (const sub of subscribers) {
    const citySlug = sub.city_slug || 'losangeles'; // Default to LA if no preference
    const cityName = CITY_NAMES[citySlug] || 'Your City';

    const digestData: DigestData = {
      cityName,
      citySlug,
      events: eventsByCity[citySlug] || [],
      newEstablishments: spotsByCity[citySlug] || [],
      // Simple tip: rotate through cities based on week number
      tip: {
        headline: `Dog-Friendly Tip #${weekNum % 100 + 1}`,
        body: `Explore the best dog-friendly spots in ${cityName} on Paw Cities. New places and events are added every week!`,
        city: citySlug,
      },
    };

    try {
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Paw Cities <noreply@pawcities.com>',
        to: [sub.email],
        subject: `This week in ${cityName}: ${digestData.events.length} dog-friendly events`,
        html: buildDigestEmail(digestData, sub.unsubscribe_token),
      });

      if (error) {
        console.error(`[WEEKLY DIGEST] Failed to send to ${sub.email}: ${error.message}`);
        failed++;
      } else {
        sent++;
      }
    } catch (e) {
      console.error(`[WEEKLY DIGEST] Exception sending to ${sub.email}:`, e);
      failed++;
    }

    // Rate limit: small delay between sends to avoid hitting Resend limits
    if (sent % 10 === 0 && sent > 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[WEEKLY DIGEST] Complete: ${sent} sent, ${failed} failed, ${subscribers.length} total subscribers`);

  return NextResponse.json({
    message: 'Weekly digest sent',
    sent,
    failed,
    totalSubscribers: subscribers.length,
  });
}
