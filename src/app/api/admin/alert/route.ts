import { NextRequest, NextResponse } from 'next/server';

// Immediate email alert to Eric (2026-08-24).
//
// WHY: when Instagram flagged @thepawcities, the browser sessions saw the
// wall but only mentioned it in their chat reports — no push notification
// reached Eric. This endpoint lets any agent/session fire a real email the
// moment it detects something requiring a human (account walls, verification
// challenges, blocks) instead of burying it in a report.
//
// POST { secret, subject, message } → email via Resend to Eric.
// Rate-limited by design: one alert per subject per 6h (in-memory best effort
// + the caller's own discipline) to avoid alert storms.

const recentAlerts = new Map<string, number>();

export async function POST(request: NextRequest) {
  let body: { secret?: string; subject?: string; message?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const subject = (body.subject || '').slice(0, 150);
  const message = (body.message || '').slice(0, 5000);
  if (!subject || !message) return NextResponse.json({ error: 'subject and message required' }, { status: 400 });

  const last = recentAlerts.get(subject);
  if (last && Date.now() - last < 6 * 60 * 60 * 1000) {
    return NextResponse.json({ success: true, deduped: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: 'resend_not_configured' }, { status: 500 });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Paw Cities Alerts <alerts@pawcities.com>',
      to: ['eric@ericdetermined.com'],
      subject: `🚨 ${subject}`,
      html: `<div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#dc2626">🚨 Action needed: ${subject}</h2>
        <p style="white-space:pre-wrap">${message.replace(/</g, '&lt;')}</p>
        <p style="color:#6b7280;font-size:12px">Sent automatically by the Paw Cities alert system the moment a human-required situation was detected.</p>
      </div>`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: 'send_failed', detail: data }, { status: 502 });

  recentAlerts.set(subject, Date.now());
  return NextResponse.json({ success: true, id: data.id });
}
