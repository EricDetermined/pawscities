import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';

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

/** Check photo coverage — establishments missing images entirely.
 *  (2026-07-23: staleness/"last refreshed" tracking removed — the priority
 *  is that every active listing has at least one photo, not photo age.) */
async function checkPhotoFreshness(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Count establishments with no photo_refs
    const { count: noPhotos } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE')
      .or('photo_refs.is.null,photo_refs.eq.{}');

    const { count: totalActive } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const noPhotoCount = noPhotos || 0;
    const total = totalActive || 0;

    let status: CheckStatus = 'healthy';
    if (noPhotoCount > 0) status = 'warning';
    if (noPhotoCount > 20) status = 'critical';

    return {
      name: 'Photo Coverage',
      status,
      message: noPhotoCount > 0
        ? `${noPhotoCount} of ${total} active establishments have no photos — prioritize filling these`
        : `Full coverage — all ${total} active establishments have photos`,
      details: { total, noPhotos: noPhotoCount },
    };
  } catch (err) {
    return { name: 'Photo Coverage', status: 'critical', message: `Check failed: ${String(err)}` };
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

/** Check that ALL city pages and key site pages are responding */
async function checkSitePages(): Promise<CheckResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';

  // CRITICAL: Check EVERY city page, not just a few.
  // Include both canonical slugs and hyphenated alternatives for multi-word cities.
  const pages = [
    '/',                // Homepage
    '/geneva',          // Single-word cities
    '/paris',
    '/london',
    '/barcelona',
    '/sydney',
    '/tokyo',
    '/losangeles',      // Multi-word cities (canonical)
    '/newyork',
    '/atlanta',         // 9th city
    '/los-angeles',     // Multi-word cities (hyphenated — user-typed URLs)
    '/new-york',
    '/ambassadors',     // Key feature pages
    '/for-business',
  ];
  const results: { page: string; status: number; ok: boolean }[] = [];

  // Run checks in parallel (with concurrency limit of 4 to avoid self-DDoS)
  const batchSize = 4;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        try {
          const res = await fetch(`${baseUrl}${page}`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10000),
            redirect: 'follow',
          });
          return { page, status: res.status, ok: res.ok };
        } catch {
          return { page, status: 0, ok: false };
        }
      })
    );
    results.push(...batchResults);
  }

  const failures = results.filter(r => !r.ok);
  if (failures.length === 0) {
    return { name: 'Site Pages', status: 'healthy', message: `All ${pages.length} pages responding (${pages.length} checked)`, details: { results } };
  }

  // Any city page 404 is critical — these are our core product pages
  const cityFailures = failures.filter(f => f.page !== '/' && f.page !== '/ambassadors' && f.page !== '/for-business');
  const status: CheckStatus = cityFailures.length > 0 ? 'critical' : failures.length >= 3 ? 'critical' : 'warning';
  return {
    name: 'Site Pages',
    status,
    message: `${failures.length}/${pages.length} pages failing: ${failures.map(f => `${f.page} (${f.status})`).join(', ')}`,
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

/** Check that yesterday's posts actually went through (2 per day expected) */
async function checkYesterdayPosts(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dayBefore = new Date(now);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);

    const yStr = yesterday.toISOString().split('T')[0];
    const dbStr = dayBefore.toISOString().split('T')[0];

    // Count posts from yesterday
    const { data: yesterdayPosts } = await supabase
      .from('social_posts')
      .select('id, headline, status, posted_at')
      .gte('posted_at', `${yStr}T00:00:00Z`)
      .lt('posted_at', `${now.toISOString().split('T')[0]}T00:00:00Z`);

    const published = (yesterdayPosts || []).filter(p => p.status === 'published');
    const failed = (yesterdayPosts || []).filter(p => p.status === 'failed');

    if (published.length >= 2) {
      return {
        name: 'Yesterday Posts',
        status: 'healthy',
        message: `${published.length} posts published yesterday (${yStr})`,
        details: { date: yStr, published: published.length, failed: failed.length, posts: published.map(p => p.headline) },
      };
    }

    if (published.length === 1) {
      return {
        name: 'Yesterday Posts',
        status: 'warning',
        message: `Only 1 of 2 expected posts published yesterday (${yStr}) — missed a slot`,
        details: { date: yStr, published: published.length, failed: failed.length },
      };
    }

    return {
      name: 'Yesterday Posts',
      status: 'critical',
      message: `No posts published yesterday (${yStr}) — posting pipeline may be down`,
      details: { date: yStr, published: 0, failed: failed.length },
    };
  } catch (err) {
    return { name: 'Yesterday Posts', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

/** Check creative queue has enough approved content for the next 7 days */
async function checkCreativeQueueDepth(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Count approved creatives ready to post
    const { count: approvedCount } = await supabase
      .from('creative_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Count pending_review creatives (backlog)
    const { count: pendingCount } = await supabase
      .from('creative_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');

    const approved = approvedCount || 0;
    const pending = pendingCount || 0;

    // We post 2/day, so need 14 approved for 7 days
    if (approved >= 14) {
      return {
        name: 'Creative Queue',
        status: 'healthy',
        message: `${approved} approved creatives (${Math.floor(approved / 2)} days of content), ${pending} pending review`,
        details: { approved, pending, daysOfContent: Math.floor(approved / 2) },
      };
    }

    if (approved >= 6) {
      return {
        name: 'Creative Queue',
        status: 'warning',
        message: `Only ${approved} approved creatives (${Math.floor(approved / 2)} days) — generate more soon`,
        details: { approved, pending, daysOfContent: Math.floor(approved / 2) },
      };
    }

    return {
      name: 'Creative Queue',
      status: 'critical',
      message: `Only ${approved} approved creatives — will run dry in ${Math.floor(approved / 2)} days!`,
      details: { approved, pending, daysOfContent: Math.floor(approved / 2) },
    };
  } catch (err) {
    return { name: 'Creative Queue', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

/** Check that key crons have produced recent output */
async function checkCronExecution(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();
    const issues: string[] = [];
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Check social posting cron: should have posts in the last 48h
    const { count: recentPosts } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('posted_at', twoDaysAgo);
    if ((recentPosts || 0) === 0) {
      issues.push('social-post: no posts in 48h');
    }

    // Check event discovery: should have ingested events recently
    const { count: recentEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoDaysAgo);
    // Discovery doesn't always find events, so just warn
    if ((recentEvents || 0) === 0) {
      // Not critical — discovery may not find new events every day
    }

    // Check health-check itself: should have recent entries
    const { count: recentHealth, error: healthErr } = await supabase
      .from('health_checks')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', twoDaysAgo);
    if (healthErr) {
      // Table may not exist yet — skip self-check rather than false-flagging
    } else if ((recentHealth || 0) === 0) {
      issues.push('health-check: no records in 48h (possible table issue)');
    }

    // Check photo refresh: runs biweekly (1st & 15th), allow 18-day window
    const eighteenDaysAgo = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentRefresh } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', eighteenDaysAgo);
    if ((recentRefresh || 0) === 0) {
      issues.push('refresh-photos: no establishment updates in 18 days (runs 1st & 15th)');
    }

    if (issues.length === 0) {
      return {
        name: 'Cron Execution',
        status: 'healthy',
        message: 'All monitored crons produced recent output',
        details: { recentPosts, recentHealth, recentRefresh },
      };
    }

    const status: CheckStatus = issues.some(i => i.includes('social-post')) ? 'critical' : 'warning';
    return {
      name: 'Cron Execution',
      status,
      message: issues.join('; '),
      details: { recentPosts, recentHealth, recentRefresh, issues },
    };
  } catch (err) {
    return { name: 'Cron Execution', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

/** Auto-archive past APPROVED events and report */
async function checkAndCleanPastEvents(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // Find past APPROVED events
    const { data: pastEvents } = await supabase
      .from('events')
      .select('id, name, start_date')
      .eq('status', 'APPROVED')
      .lt('start_date', today);

    if (!pastEvents || pastEvents.length === 0) {
      return {
        name: 'Past Event Cleanup',
        status: 'healthy',
        message: 'No stale past events — all APPROVED events are upcoming',
      };
    }

    // Auto-archive them to CANCELLED with a review note
    let archived = 0;
    for (const ev of pastEvents) {
      const { error } = await supabase
        .from('events')
        .update({
          status: 'CANCELLED',
          review_notes: 'Auto-archived by daily health check: event date has passed',
        })
        .eq('id', ev.id);
      if (!error) archived++;
    }

    return {
      name: 'Past Event Cleanup',
      status: 'warning',
      message: `Archived ${archived} past events (were still APPROVED after their dates)`,
      details: {
        archived,
        events: pastEvents.map(e => `${e.name} (${e.start_date})`).slice(0, 5),
      },
    };
  } catch (err) {
    return { name: 'Past Event Cleanup', status: 'warning', message: `Check failed: ${String(err)}` };
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

/** Audit establishment data quality — flag listings missing key fields */
async function checkEstablishmentQuality(): Promise<CheckResult> {
  try {
    const supabase = getSupabaseAdmin();

    const { count: totalActive } = await supabase
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');

    const total = totalActive || 0;

    // Count establishments missing each key field
    const [noDesc, noAddress, noPhone, noPhotos, noGoogleId, noRating] = await Promise.all([
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').or('description.is.null,description.eq.'),
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').or('address.is.null,address.eq.'),
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').or('phone.is.null,phone.eq.'),
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').or('photo_refs.is.null,photo_refs.eq.{}'),
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').is('google_place_id', null),
      supabase.from('establishments').select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE').or('rating.is.null,rating.eq.0'),
    ]);

    const gaps = {
      noDescription: noDesc.count || 0,
      noAddress: noAddress.count || 0,
      noPhone: noPhone.count || 0,
      noPhotos: noPhotos.count || 0,
      noGooglePlaceId: noGoogleId.count || 0,
      noRating: noRating.count || 0,
    };

    // Calculate completeness score (weighted)
    const photoScore = total > 0 ? ((total - gaps.noPhotos) / total) * 100 : 0;
    const addressScore = total > 0 ? ((total - gaps.noAddress) / total) * 100 : 0;
    const descScore = total > 0 ? ((total - gaps.noDescription) / total) * 100 : 0;
    const avgScore = (photoScore + addressScore + descScore) / 3;

    const issues: string[] = [];
    if (gaps.noPhotos > 10) issues.push(`${gaps.noPhotos} missing photos`);
    if (gaps.noAddress > 20) issues.push(`${gaps.noAddress} missing address`);
    if (gaps.noDescription > total * 0.3) issues.push(`${gaps.noDescription} missing description`);
    if (gaps.noPhone > total * 0.5) issues.push(`${gaps.noPhone} missing phone`);

    let status: CheckStatus = 'healthy';
    if (avgScore < 80) status = 'warning';
    if (avgScore < 60 || gaps.noPhotos > 30) status = 'critical';

    return {
      name: 'Establishment Quality',
      status,
      message: issues.length > 0
        ? `Quality score ${avgScore.toFixed(0)}% — ${issues.join('; ')}`
        : `Quality score ${avgScore.toFixed(0)}% — ${total} establishments with good data coverage`,
      details: { total, gaps, scores: { photo: photoScore.toFixed(1), address: addressScore.toFixed(1), description: descScore.toFixed(1), average: avgScore.toFixed(1) } },
    };
  } catch (err) {
    return { name: 'Establishment Quality', status: 'warning', message: `Check failed: ${String(err)}` };
  }
}

/** Smoke-test the business claim/signup funnel — verify key endpoints respond */
async function checkBusinessClaimFlow(): Promise<CheckResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  const issues: string[] = [];

  try {
    // 1. Check /for-business page loads
    const forBizRes = await fetch(`${baseUrl}/for-business`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    if (!forBizRes.ok) issues.push(`/for-business returned ${forBizRes.status}`);

    // 2. Check business search API responds (empty query should return empty, not error)
    const searchRes = await fetch(`${baseUrl}/api/business/search?q=test`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!searchRes.ok) {
      issues.push(`business search API returned ${searchRes.status}`);
    }

    // 3. Check business submit GET (returns cities + categories for form)
    const submitGetRes = await fetch(`${baseUrl}/api/business/submit`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!submitGetRes.ok) {
      issues.push(`business submit API returned ${submitGetRes.status}`);
    } else {
      const submitData = await submitGetRes.json();
      if (!submitData.cities || submitData.cities.length === 0) {
        issues.push('business submit API returned no cities');
      }
      if (!submitData.categories || submitData.categories.length === 0) {
        issues.push('business submit API returned no categories');
      }
    }

    // 4. Check claim POST rejects properly (missing fields = 400, not 500)
    const claimRes = await fetch(`${baseUrl}/api/business/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // empty body should get 400 validation error
      signal: AbortSignal.timeout(10000),
    });
    // We expect 400 (validation) or 401 (auth required) — anything else is broken
    if (claimRes.status >= 500) {
      issues.push(`business claim API returned ${claimRes.status} (server error on empty payload)`);
    }

    if (issues.length === 0) {
      return {
        name: 'Business Claim Flow',
        status: 'healthy',
        message: 'All business signup endpoints responding correctly',
      };
    }

    return {
      name: 'Business Claim Flow',
      status: issues.some(i => i.includes('500')) ? 'critical' : 'warning',
      message: issues.join('; '),
      details: { issues },
    };
  } catch (err) {
    return { name: 'Business Claim Flow', status: 'critical', message: `Flow check failed: ${String(err)}` };
  }
}

/** Smoke-test the ambassador invite flow — verify invite validation works */
async function checkAmbassadorFlow(): Promise<CheckResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  const issues: string[] = [];

  try {
    // 1. Check /ambassadors page loads
    const ambassadorRes = await fetch(`${baseUrl}/ambassadors`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    if (!ambassadorRes.ok) issues.push(`/ambassadors returned ${ambassadorRes.status}`);

    // 2. Verify invite validation rejects invalid codes properly (400, not 500)
    const verifyRes = await fetch(`${baseUrl}/api/ambassadors/verify-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INVALID-TEST-CODE' }),
      signal: AbortSignal.timeout(10000),
    });
    // We expect 400 or 404 for invalid code — 500 means the endpoint is broken
    if (verifyRes.status >= 500) {
      issues.push(`invite verification API returned ${verifyRes.status} (server error)`);
    } else {
      const verifyData = await verifyRes.json();
      // Should return { valid: false } or an error — not crash
      if (verifyRes.ok && verifyData.valid === true) {
        issues.push('invite verification accepted a fake code (security issue)');
      }
    }

    // 3. Check we have at least one active invite in the system
    const supabase = getSupabaseAdmin();
    const { count: activeInvites } = await supabase
      .from('ambassador_invites')
      .select('*', { count: 'exact', head: true })
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    if ((activeInvites || 0) === 0) {
      issues.push('no active ambassador invites exist');
    }

    if (issues.length === 0) {
      return {
        name: 'Ambassador Flow',
        status: 'healthy',
        message: `Ambassador invite flow operational — ${activeInvites} active invite(s)`,
        details: { activeInvites },
      };
    }

    return {
      name: 'Ambassador Flow',
      status: issues.some(i => i.includes('500') || i.includes('security')) ? 'critical' : 'warning',
      message: issues.join('; '),
      details: { issues, activeInvites },
    };
  } catch (err) {
    return { name: 'Ambassador Flow', status: 'warning', message: `Flow check failed: ${String(err)}` };
  }
}

// ——— Email Alert (uses shared email utility — no more inline Resend) ————————

// Import the shared email function that handles Resend properly
import { sendHealthReport } from '@/lib/email';

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
  // Verify cron secret (supports both Authorization header and query param)
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const skipEmail = searchParams.get('skipEmail') === 'true';

  // Run all health checks in parallel
  const checks = await Promise.all([
    checkInstagramToken(),
    checkGooglePlacesAPI(),
    checkDatabase(),
    checkPhotoFreshness(),
    checkEstablishmentQuality(),
    checkInstagramPosting(),
    checkYesterdayPosts(),
    checkCreativeQueueDepth(),
    checkCronExecution(),
    checkSitePages(),
    checkPhotoProxy(),
    checkEmailService(),
    checkBusinessClaimFlow(),
    checkAmbassadorFlow(),
    checkAndCleanPastEvents(),
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

  // Email: Only send standalone health email for CRITICAL issues or if explicitly requested
  // The unified marketing-digest cron (12 PM UTC) now includes health status daily
  const forceEmail = searchParams.get('forceEmail') === 'true';
  let emailResult: { success: boolean; error?: string } = { success: false, error: 'skipped — use marketing digest' };
  if (!skipEmail && (forceEmail || overall === 'critical')) {
    emailResult = await sendHealthReport(report);
    if (!emailResult.success) {
      console.error(`[HEALTH] Email delivery FAILED: ${emailResult.error}`);
    }
  }

  console.log(`[HEALTH] ${summary} | email: ${emailResult.success ? 'sent' : emailResult.error}`);

  // FIX: Include email delivery status in response so failures are visible
  return NextResponse.json({
    ...report,
    emailDelivered: emailResult.success,
    emailError: emailResult.error || null,
  });
}
