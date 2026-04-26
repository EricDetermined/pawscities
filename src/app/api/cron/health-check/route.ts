import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ——— Health Check Types ———————————————————————————————————————————————————————

type CheckStatus = 'healthy' | 'warning' | 'critical';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

interface HealthReport {
  timestamp: string;
  overall: CheckStatus;
  checks: CheckResult[];
  summary: string;
}

export const maxDuration = 60; // 1 minute max

// ——— Individual Health Checks ————————————————————————————————————————————————

/** Check if the Meta/Instagram access token is still valid */
async function checkInstagramToken(): Promise<CheckResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    return { name: 'Instagram Token', status: 'critical', message: 'META_PAGE_ACCESS_TOKEN not configured' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/me?access_token=${token}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();

    if (data.error) {
      return {
        name: 'Instagram Token',
        status: 'critical',
        message: `Token invalid: ${data.error.message}`,
        details: { error_type: data.error.type, error_code: data.error.code },
      };
    }

    // Check data access expiry from env (set in .env.instagram comment)
    return {
      name: 'Instagram Token',
      status: 'healthy',
      message: `Token valid — connected to "${data.name}"`,
      details: { page_name: data.name, page_id: data.id },
    };
  } catch (err) {
    return {
      name: 'Instagram Token',
      status: 'critical',
      message: `Token check failed: ${String(err)}`,
    };
  }
}

/** Check if Google Places API key is working */
async function checkGooglePlacesAPI(): Promise<CheckResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return { name: 'Google Places API', status: 'critical', message: 'GOOGLE_PLACES_API_KEY not configured' };
  }

  try {
    // Test with a simple place search
    const res = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName',
        },
        body: JSON.stringify({ textQuery: 'Eiffel Tower Paris', maxResultCount: 1 }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        name: 'Google Places API',
        status: 'critical',
        message: `API returned ${res.status}: ${data?.error?.message || 'Unknown error'}`,
      };
    }

    return { name: 'Google Places API', status: 'healthy', message: 'API key valid and responding' };
  } catch (err) {
    return { name: 'Google Places API', status: 'critical', message: `API check failed: ${String(err)}` };
  }
}

/** Check database connectivity and data integrity */
async function checkDatabase(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Test basic connectivity + get counts
    const { count: estCount, error: estError } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    if (estError) {
      return { name: 'Database', status: 'critical', message: `Query failed: ${estError.message}` };
    }

    const { count: cityCount } = await supabase
      .from('cities')
      .select('*', { count: 'exact', head: true });

    return {
      name: 'Database',
      status: 'healthy',
      message: `Connected — ${estCount} active establishments across ${cityCount} cities`,
      details: { establishments: estCount, cities: cityCount },
    };
  } catch (err) {
    return { name: 'Database', status: 'critical', message: `Connection failed: ${String(err)}` };
  }
}

/** Check photo freshness — how many establishments have stale or missing photos */
async function checkPhotoFreshness(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Count establishments with no photo_refs
    const { count: noPhotos } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .or('photo_refs.is.null,photo_refs.eq.{}');

    // Count establishments not refreshed in the last 10 days
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { count: stalePhotos } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .not('google_place_id', 'is', null)
      .lt('updated_at', tenDaysAgo);

    const { count: totalActive } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const noPhotoCount = noPhotos || 0;
    const staleCount = stalePhotos || 0;
    const total = totalActive || 0;

    let status: CheckStatus = 'healthy';
    const issues: string[] = [];

    if (noPhotoCount > 5) {
      status = 'warning';
      issues.push(`${noPhotoCount} establishments have no photos`);
    }
    if (noPhotoCount > 20) status = 'critical';

    if (staleCount > 50) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`${staleCount} establishments not refreshed in 10+ days`);
    }
    if (staleCount > 150) status = 'critical';

    return {
      name: 'Photo Freshness',
      status,
      message: issues.length > 0
        ? issues.join('; ')
        : `All photos fresh — ${total} establishments with active photos`,
      details: { total, noPhotos: noPhotoCount, stalePhotos: staleCount },
    };
  } catch (err) {
    return { name: 'Photo Freshness', status: 'critical', message: `Check failed: ${String(err)}` };
  }
}

/** Check recent Instagram posting history */
async function checkInstagramPosting(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Get last successful post
    const { data: lastPost } = await supabase
      .from('social_posts')
      .select('created_at, headline, city, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get recent failures
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentFailures } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo);

    if (!lastPost) {
      return { name: 'Instagram Posting', status: 'warning', message: 'No published posts found in database' };
    }

    const lastPostDate = new Date(lastPost.created_at);
    const daysSincePost = Math.floor((Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));

    let status: CheckStatus = 'healthy';
    const issues: string[] = [];

    // Posts should happen Mon/Wed/Fri — warn if >4 days since last post
    if (daysSincePost > 4) {
      status = 'warning';
      issues.push(`Last post was ${daysSincePost} days ago`);
    }
    if (daysSincePost > 7) {
      status = 'critical';
    }

    if ((recentFailures || 0) > 2) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`${recentFailures} failed posts in the last 7 days`);
    }

    return {
      name: 'Instagram Posting',
      status,
      message: issues.length > 0
        ? issues.join('; ')
        : `Healthy — last post "${lastPost.headline}" (${lastPost.city}) ${daysSincePost}d ago`,
      details: {
        lastPost: lastPost.headline,
        lastPostCity: lastPost.city,
        daysSincePost,
        recentFailures: recentFailures || 0,
      },
    };
  } catch (err) {
    return { name: 'Instagram Posting', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

/** Check that key site pages are responding */
async function checkSitePages(): Promise<CheckResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  const pages = ['/', '/paris', '/london', '/sydney', '/api/places/photo?name=test'];
  const results: { page: string; status: number; ok: boolean }[] = [];

  for (const page of pages) {
    try {
      const res = await fetch(`${baseUrl}${page}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      results.push({ page, status: res.status, ok: res.ok || res.status === 400 }); // 400 expected for photo test
    } catch {
      results.push({ page, status: 0, ok: false });
    }
  }

  const failures = results.filter(r => !r.ok);
  if (failures.length === 0) {
    return { name: 'Site Pages', status: 'healthy', message: `All ${pages.length} pages responding`, details: { results } };
  }

  const status: CheckStatus = failures.length >= 3 ? 'critical' : 'warning';
  return {
    name: 'Site Pages',
    status,
    message: `${failures.length}/${pages.length} pages failing: ${failures.map(f => f.page).join(', ')}`,
    details: { results },
  };
}

/** Check photo proxy is working (Google Places photo endpoint) */
async function checkPhotoProxy(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Get a random establishment with photo refs to test
    const { data: est } = await supabase
      .from('establishments')
      .select('name, photo_refs')
      .not('photo_refs', 'is', null)
      .eq('status', 'ACTIVE')
      .limit(1)
      .single();

    if (!est || !est.photo_refs || est.photo_refs.length === 0) {
      return { name: 'Photo Proxy', status: 'warning', message: 'No photo refs found to test' };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
    const photoUrl = `${baseUrl}/api/places/photo?name=${encodeURIComponent(est.photo_refs[0])}&maxWidth=100`;

    const res = await fetch(photoUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      return {
        name: 'Photo Proxy',
        status: 'healthy',
        message: `Proxy working — tested with "${est.name}"`,
      };
    }

    return {
      name: 'Photo Proxy',
      status: 'warning',
      message: `Proxy returned ${res.status} for "${est.name}"`,
    };
  } catch (err) {
    return { name: 'Photo Proxy', status: 'warning', message: `Proxy check failed: ${String(err)}` };
  }
}

/** Check Resend email service */
async function checkEmailService(): Promise<CheckResult> {
  if (!process.env.RESEND_API_KEY) {
    return { name: 'Email Service', status: 'warning', message: 'RESEND_API_KEY not configured' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Just verify the API key works by listing domains
    const { error } = await resend.domains.list();
    if (error) {
      return { name: 'Email Service', status: 'warning', message: `Resend API error: ${error.message}` };
    }
    return { name: 'Email Service', status: 'healthy', message: 'Resend API connected' };
  } catch (err) {
    return { name: 'Email Service', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

// ——— Email Alert ————————————————————————————————————————————————————————————

async function sendHealthAlert(report: HealthReport) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[HEALTH] No RESEND_API_KEY — skipping email alert');
    return;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (adminEmails.length === 0) {
    console.warn('[HEALTH] No ADMIN_EMAILS configured — skipping email alert');
    return;
  }

  const statusEmoji = { healthy: '✅', warning: '⚠️', critical: '🚨' };
  const statusColor = { healthy: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

  const checksHtml = report.checks.map(c => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        ${statusEmoji[c.status]} ${c.name}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: ${statusColor[c.status]}; font-weight: 600;">
        ${c.status.toUpperCase()}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        ${c.message}
      </td>
    </tr>
  `).join('');

  const subject = report.overall === 'healthy'
    ? '✅ PawCities Daily Health Report — All Systems Healthy'
    : report.overall === 'warning'
      ? '⚠️ PawCities Health Alert — Issues Detected'
      : '🚨 PawCities CRITICAL Alert — Immediate Action Needed';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 20px;">
  <div style="max-width: 640px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${statusColor[report.overall]}; padding: 24px 32px; color: white;">
      <h1 style="margin: 0; font-size: 22px;">🐾 PawCities Health Report</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${new Date(report.timestamp).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
    </div>
    <div style="padding: 24px 32px;">
      <div style="background: ${statusColor[report.overall]}15; border: 1px solid ${statusColor[report.overall]}40; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <strong style="color: ${statusColor[report.overall]}; font-size: 16px;">
          ${statusEmoji[report.overall]} Overall: ${report.overall.toUpperCase()}
        </strong>
        <p style="margin: 8px 0 0; color: #374151; font-size: 14px;">${report.summary}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 16px; text-align: left; font-weight: 600; color: #374151;">Service</th>
            <th style="padding: 10px 16px; text-align: left; font-weight: 600; color: #374151;">Status</th>
            <th style="padding: 10px 16px; text-align: left; font-weight: 600; color: #374151;">Details</th>
          </tr>
        </thead>
        <tbody>${checksHtml}</tbody>
      </table>
      <div style="margin-top: 24px; text-align: center;">
        <a href="https://pawcities.com/admin/health" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Health Dashboard →
        </a>
      </div>
    </div>
    <div style="padding: 16px 32px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af;">
      PawCities Automated Health Monitor • <a href="https://pawcities.com/admin/health" style="color: #f97316;">Dashboard</a>
    </div>
  </div>
</body>
</html>`;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Paw Cities <noreply@pawcities.com>',
      to: adminEmails,
      subject,
      html,
    });
    console.log(`[HEALTH] Alert email sent to ${adminEmails.join(', ')}`);
  } catch (err) {
    console.error('[HEALTH] Failed to send alert email:', err);
  }
}

// ——— Store Results in Supabase ——————————————————————————————————————————————

async function storeHealthReport(report: HealthReport) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('health_checks').insert({
      timestamp: report.timestamp,
      overall_status: report.overall,
      checks: report.checks,
      summary: report.summary,
    });
  } catch (err) {
    // Table might not exist yet — log but don't fail
    console.warn('[HEALTH] Could not store report (table may not exist):', err);
  }
}

// ——— Main Handler ———————————————————————————————————————————————————————————

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skipEmail = searchParams.get('skipEmail') === 'true';

  // Run all health checks in parallel
  const checks = await Promise.all([
    checkInstagramToken(),
    checkGooglePlacesAPI(),
    checkDatabase(),
    checkPhotoFreshness(),
    checkInstagramPosting(),
    checkSitePages(),
    checkPhotoProxy(),
    checkEmailService(),
  ]);

  // Determine overall status
  const hasCritical = checks.some(c => c.status === 'critical');
  const hasWarning = checks.some(c => c.status === 'warning');
  const overall: CheckStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';

  const healthyCount = checks.filter(c => c.status === 'healthy').length;
  const summary = overall === 'healthy'
    ? `All ${checks.length} services healthy`
    : `${healthyCount}/${checks.length} healthy — ${checks.filter(c => c.status !== 'healthy').map(c => c.name).join(', ')} need attention`;

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    overall,
    checks,
    summary,
  };

  // Store the report
  await storeHealthReport(report);

  // Send email alert (always for daily cron, skip for manual checks if requested)
  if (!skipEmail) {
    await sendHealthAlert(report);
  }

  console.log(`[HEALTH] ${summary}`);

  return NextResponse.json(report);
}
