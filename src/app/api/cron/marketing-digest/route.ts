import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMarketingDigest, type MarketingDigestData } from '@/lib/email';
import { verifyCronAuth } from '@/lib/cron-auth';
function getMetaToken() { return process.env.META_PAGE_ACCESS_TOKEN; }
function getInstagramAccountId() { return process.env.INSTAGRAM_ACCOUNT_ID; }
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v21.0'; }
function getInstagramUsername() { return process.env.INSTAGRAM_USERNAME || 'thepawcities'; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 120;

/**
 * Unified Marketing Digest
 *
 * Runs daily at 12 PM UTC (after engagement at 10AM and outreach at 11AM).
 * Consolidates all marketing intelligence into ONE email:
 * - System health (runs inline health checks)
 * - Posts published yesterday
 * - Comment activity & auto-reply results
 * - Engagement opportunities
 * - Community intelligence
 * - Event discoveries
 *
 * This is the SINGLE daily email Eric receives — no more fragmented alerts.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const META_PAGE_ACCESS_TOKEN = getMetaToken();
  const INSTAGRAM_ACCOUNT_ID = getInstagramAccountId();
  const META_API_VERSION = getMetaApiVersion();
  const OUR_USERNAME = getInstagramUsername();

  const supabase = getSupabaseAdmin();

  // When true, compute everything and return JSON but DON'T send the email.
  // Used by the in-app monitor so the daily email is sent by exactly one trigger.
  const skipEmail = request.nextUrl.searchParams.get('skipEmail') === 'true';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. SYSTEM HEALTH — Quick inline checks (fallback if the full suite is unreachable)
    // ═══════════════════════════════════════════════════════════════
    let healthChecks: { name: string; status: 'healthy' | 'warning' | 'critical'; message: string }[] = [];

    // Instagram token
    if (META_PAGE_ACCESS_TOKEN && INSTAGRAM_ACCOUNT_ID) {
      try {
        const res = await fetch(`https://graph.facebook.com/v25.0/me?access_token=${META_PAGE_ACCESS_TOKEN}`, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        healthChecks.push(data.error
          ? { name: 'Instagram Token', status: 'critical', message: `Invalid: ${data.error.message}` }
          : { name: 'Instagram Token', status: 'healthy', message: `Connected to "${data.name}"` }
        );
      } catch {
        healthChecks.push({ name: 'Instagram Token', status: 'critical', message: 'Token check timed out' });
      }
    } else {
      healthChecks.push({ name: 'Instagram Token', status: 'critical', message: 'Not configured' });
    }

    // Database
    try {
      const { count: estCount } = await supabase
        .from('establishments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE');
      healthChecks.push({ name: 'Database', status: 'healthy', message: `${estCount} active establishments` });
    } catch {
      healthChecks.push({ name: 'Database', status: 'critical', message: 'Connection failed' });
    }

    // Photo freshness
    try {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const { count: stalePhotos } = await supabase
        .from('establishments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE')
        .not('google_place_id', 'is', null)
        .lt('updated_at', tenDaysAgo);
      const stale = stalePhotos || 0;
      healthChecks.push({
        name: 'Photo Freshness',
        status: stale > 50 ? 'critical' : stale > 20 ? 'warning' : 'healthy',
        message: stale > 0 ? `${stale} establishments stale (10+ days)` : 'All photos fresh',
      });
    } catch {
      healthChecks.push({ name: 'Photo Freshness', status: 'warning', message: 'Check failed' });
    }

    // Email service
    if (process.env.RESEND_API_KEY) {
      healthChecks.push({ name: 'Email Service', status: 'healthy', message: 'Resend configured' });
    } else {
      healthChecks.push({ name: 'Email Service', status: 'critical', message: 'RESEND_API_KEY missing' });
    }

    // Site pages — check ALL city pages so 404s get flagged in the daily email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawcities.com';
      const cityPages = [
        '/', '/geneva', '/paris', '/london', '/barcelona', '/sydney', '/tokyo',
        '/losangeles', '/newyork', '/los-angeles', '/new-york',
      ];
      const pageResults = await Promise.all(
        cityPages.map(async (page) => {
          try {
            const res = await fetch(`${baseUrl}${page}`, {
              method: 'HEAD',
              signal: AbortSignal.timeout(8000),
              redirect: 'follow',
            });
            return { page, status: res.status, ok: res.ok };
          } catch {
            return { page, status: 0, ok: false };
          }
        })
      );
      const pageFailures = pageResults.filter(r => !r.ok);
      if (pageFailures.length > 0) {
        healthChecks.push({
          name: 'Site Pages',
          status: 'critical',
          message: `${pageFailures.length} pages DOWN: ${pageFailures.map(f => `${f.page} (${f.status})`).join(', ')}`,
        });
      } else {
        healthChecks.push({
          name: 'Site Pages',
          status: 'healthy',
          message: `All ${cityPages.length} pages responding`,
        });
      }
    } catch {
      healthChecks.push({ name: 'Site Pages', status: 'warning', message: 'Page check failed' });
    }

    // ─── Pull the COMPREHENSIVE health suite + creative grid audit ──────────────
    // The dedicated health-check endpoint runs deep ops validation the inline
    // checks above don't cover (yesterday's posts, creative-queue depth, cron
    // execution, IG posting history, photo proxy, etc.). We fetch it with
    // skipEmail=true so it never sends its own email — this digest is the one email.
    let creativeGrid: MarketingDigestData['creativeGrid'] | undefined;
    if (cronSecret) {
      const [hcResult, coResult] = await Promise.allSettled([
        fetch(`${baseUrl}/api/cron/health-check?secret=${cronSecret}&skipEmail=true`, {
          signal: AbortSignal.timeout(45000),
        }),
        fetch(`${baseUrl}/api/cron/creative-oversight?secret=${cronSecret}`, {
          signal: AbortSignal.timeout(45000),
        }),
      ]);

      // Replace inline checks with the full suite when available
      if (hcResult.status === 'fulfilled' && hcResult.value.ok) {
        try {
          const hc = await hcResult.value.json();
          if (Array.isArray(hc.checks) && hc.checks.length > 0) {
            healthChecks = hc.checks.map((c: { name: string; status: 'healthy' | 'warning' | 'critical'; message: string }) => ({
              name: c.name,
              status: c.status,
              message: c.message,
            }));
          }
        } catch (e) {
          console.warn('[MARKETING-DIGEST] Could not parse health-check suite, using inline checks:', e);
        }
      }

      // Add creative grid diversity from the oversight audit
      if (coResult.status === 'fulfilled' && coResult.value.ok) {
        try {
          const co = await coResult.value.json();
          if (typeof co.gridHealthScore === 'number') {
            const topIssues = (co.issues || [])
              .filter((i: { severity: string }) => i.severity === 'high' || i.severity === 'medium')
              .slice(0, 5)
              .map((i: { description: string }) => i.description);
            creativeGrid = {
              score: co.gridHealthScore,
              status: co.gridHealth || 'unknown',
              issuesFound: co.summary?.issuesFound ?? (co.issues || []).length,
              topIssues,
            };
            // Surface a low grid score as a health check so it rolls into overall status
            if (co.gridHealthScore < 50) {
              healthChecks.push({ name: 'Creative Grid', status: 'warning', message: `Grid diversity ${co.gridHealthScore}/100 — ${creativeGrid.issuesFound} issue(s)` });
            }
          }
        } catch (e) {
          console.warn('[MARKETING-DIGEST] Could not parse creative-oversight audit:', e);
        }
      }
    }

    const hasCritical = healthChecks.some(c => c.status === 'critical');
    const hasWarning = healthChecks.some(c => c.status === 'warning');
    const healthOverall = hasCritical ? 'critical' as const : hasWarning ? 'warning' as const : 'healthy' as const;
    const healthyCount = healthChecks.filter(c => c.status === 'healthy').length;
    const healthSummary = healthOverall === 'healthy'
      ? `All ${healthChecks.length} services healthy`
      : `${healthyCount}/${healthChecks.length} healthy — ${healthChecks.filter(c => c.status !== 'healthy').map(c => c.name).join(', ')} need attention`;

    // ═══════════════════════════════════════════════════════════════
    // 2. POSTS PUBLISHED (last 24 hours)
    // ═══════════════════════════════════════════════════════════════
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query creative_queue for posts published in last 24h (authoritative source)
    // The social_posts table has schema drift issues; creative_queue is always updated by the posting cron
    const { data: recentPostedCreatives } = await supabase
      .from('creative_queue')
      .select('headline, city, posted_at, social_post_id, narrator, content_type')
      .eq('status', 'posted')
      .gte('posted_at', oneDayAgo)
      .order('posted_at', { ascending: false });

    // Look up engagement stats from social_posts for any that have them
    const socialPostIds = (recentPostedCreatives || [])
      .map(c => c.social_post_id)
      .filter(Boolean);

    let engagementMap: Record<string, { likes: number; comments: number; postId?: string }> = {};
    if (socialPostIds.length > 0) {
      const { data: socialPosts } = await supabase
        .from('social_posts')
        .select('id, likes, comments_count, post_id')
        .in('id', socialPostIds);
      if (socialPosts) {
        for (const sp of socialPosts) {
          engagementMap[sp.id] = {
            likes: sp.likes || 0,
            comments: sp.comments_count || 0,
            postId: sp.post_id || undefined,
          };
        }
      }
    }

    const publishedPosts = (recentPostedCreatives || []).map(p => {
      const engagement = engagementMap[p.social_post_id] || { likes: 0, comments: 0 };
      // Construct actual Instagram post URL from post_id, fallback to profile
      const permalink = engagement.postId
        ? `https://www.instagram.com/p/${engagement.postId}/`
        : 'https://www.instagram.com/thepawcities/';
      return {
        headline: p.headline || 'Untitled',
        city: p.city || 'unknown',
        likes: engagement.likes,
        comments: engagement.comments,
        permalink,
      };
    });

    // ─── Failed Posts (last 24 hours) ──────────────────
    const { data: failedPosts } = await supabase
      .from('social_posts')
      .select('headline, city, error_message, created_at')
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    const failedPostsList = (failedPosts || []).map(p => ({
      headline: p.headline || 'Untitled',
      city: p.city || 'unknown',
      errorMessage: p.error_message || 'Unknown error',
      createdAt: p.created_at,
    }));

    // ─── Creative Queue Health (unified pipeline view) ──────────────────
    // What's queued up and ready
    const { data: approvedCreatives } = await supabase
      .from('creative_queue')
      .select('headline, narrator, city, scheduled_for, content_type, status')
      .in('status', ['approved', 'pending_review'])
      .order('scheduled_for', { ascending: true });

    const creativesRemaining = (approvedCreatives || []).length;

    // Reuse the already-fetched posted creatives from the "Posts Published" section above
    const postedCreatives = recentPostedCreatives;

    // What needs review (pending_review)
    const { count: needsReviewCount } = await supabase
      .from('creative_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review');

    // ═══════════════════════════════════════════════════════════════
    // 3. COMMENT ACTIVITY
    // ═══════════════════════════════════════════════════════════════
    // New comments in last 24h
    const { data: newComments } = await supabase
      .from('social_comments')
      .select('username, text, sentiment, replied, commented_at')
      .gte('commented_at', oneDayAgo)
      .neq('username', OUR_USERNAME)
      .order('commented_at', { ascending: false });

    const comments = newComments || [];
    const autoReplied = comments.filter(c => c.replied === true);
    const questions = comments.filter(c => c.sentiment === 'question');
    const negatives = comments.filter(c => c.sentiment === 'negative');
    const spam = comments.filter(c => c.sentiment === 'spam');

    // Total unreplied manual items (questions + negatives, all time)
    const { count: totalUnrepliedManual } = await supabase
      .from('social_comments')
      .select('*', { count: 'exact', head: true })
      .eq('replied', false)
      .in('sentiment', ['question', 'negative']);

    // ═══════════════════════════════════════════════════════════════
    // 4. TOP CONTENT PERFORMANCE
    // ═══════════════════════════════════════════════════════════════
    const { data: allPosts } = await supabase
      .from('social_posts')
      .select('likes, comments_count, caption, engagement_score, post_id')
      .eq('status', 'published')
      .not('post_id', 'is', null);

    const tracked = allPosts || [];
    const avgLikes = tracked.length > 0
      ? Math.round(tracked.reduce((s, p) => s + (p.likes || 0), 0) / tracked.length)
      : 0;
    const avgComments = tracked.length > 0
      ? Math.round((tracked.reduce((s, p) => s + (p.comments_count || 0), 0) / tracked.length) * 10) / 10
      : 0;

    const topPost = tracked.length > 0
      ? tracked.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))[0]
      : null;

    // ═══════════════════════════════════════════════════════════════
    // 5. OUTREACH OPPORTUNITIES
    // ═══════════════════════════════════════════════════════════════
    const { data: newOpps } = await supabase
      .from('social_opportunities')
      .select('permalink, caption, category, suggested_reply, likes')
      .eq('status', 'new')
      .gte('created_at', oneDayAgo)
      .order('likes', { ascending: false })
      .limit(10);

    const { count: totalPending } = await supabase
      .from('social_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    const storyReposts = (newOpps || []).filter(o => o.category === 'story_repost');

    // ═══════════════════════════════════════════════════════════════
    // 6. COMMUNITY INTELLIGENCE
    // ═══════════════════════════════════════════════════════════════
    const { data: allCommenters } = await supabase
      .from('social_comments')
      .select('username')
      .neq('username', OUR_USERNAME);

    const commentCounts: Record<string, number> = {};
    if (allCommenters) {
      for (const c of allCommenters) {
        commentCounts[c.username] = (commentCounts[c.username] || 0) + 1;
      }
    }
    const vips = Object.entries(commentCounts)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .map(([username, count]) => ({ username, commentCount: count }));

    const totalUniqueCommenters = Object.keys(commentCounts).length;

    // New commenters today (first-time engagers)
    const newCommentersToday = comments
      ? [...new Set(comments.map(c => c.username))].filter(
          username => (commentCounts[username] || 0) <= 1
        ).length
      : 0;

    // ═══════════════════════════════════════════════════════════════
    // 7. EVENTS (weekly check)
    // ═══════════════════════════════════════════════════════════════
    let eventsData: MarketingDigestData['events'] | undefined;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: newEventCount } = await supabase
      .from('ingest_queue')
      .select('*', { count: 'exact', head: true })
      .eq('classification', 'event')
      .gte('created_at', sevenDaysAgo);

    // Count PENDING events in the events table (what admin dashboard shows)
    const { count: pendingEventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Count discovery items that need review (ingest_queue)
    const { count: discoveryNeedsReviewCount } = await supabase
      .from('ingest_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'needs_review');

    if ((newEventCount || 0) > 0 || (pendingEventCount || 0) > 0 || (discoveryNeedsReviewCount || 0) > 0) {
      eventsData = {
        newDiscovered: newEventCount || 0,
        pendingReview: pendingEventCount || 0,
        discoveryNeedsReview: discoveryNeedsReviewCount || 0,
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. ASSEMBLE AND SEND THE DIGEST
    // ═══════════════════════════════════════════════════════════════
    const digestData: MarketingDigestData = {
      health: {
        overall: healthOverall,
        checks: healthChecks,
        summary: healthSummary,
      },
      postsPublished: {
        count: publishedPosts.length,
        posts: publishedPosts,
      },
      failedPosts: failedPostsList.length > 0 ? failedPostsList : undefined,
      commentActivity: {
        newComments: comments.length,
        autoReplied: autoReplied.length,
        autoReplyErrors: 0, // We don't have this from yesterday's run — tracked in engagement cron
        questionsNeedingReply: questions.length,
        negativesNeedingReview: negatives.length,
        spamBlocked: spam.length,
        totalUnrepliedManual: totalUnrepliedManual || 0,
        recentComments: comments.slice(0, 8).map(c => ({
          username: c.username,
          text: c.text,
          sentiment: c.sentiment || 'neutral',
          replied: c.replied || false,
        })),
      },
      topContent: {
        postsTracked: tracked.length,
        avgLikes,
        avgComments,
        topPost: topPost ? {
          permalink: topPost.post_id
            ? `https://www.instagram.com/p/${topPost.post_id}/`
            : 'https://www.instagram.com/thepawcities/',
          likes: topPost.likes || 0,
          comments: topPost.comments_count || 0,
          caption: (topPost.caption || '').substring(0, 150),
        } : null,
      },
      outreach: {
        newOpportunities: (newOpps || []).length,
        totalPending: totalPending || 0,
        storyRepostCandidates: storyReposts.length,
        topOpportunities: (newOpps || []).slice(0, 5).map(o => ({
          permalink: o.permalink,
          caption: o.caption || '',
          category: o.category || 'general',
          likes: o.likes || 0,
          suggestedReply: o.suggested_reply || '',
        })),
      },
      community: {
        vips: vips.slice(0, 10),
        newCommentersToday,
        totalUniqueCommenters,
      },
      events: eventsData,
      creativeQueue: {
        remaining: creativesRemaining,
        needsReview: needsReviewCount || 0,
        postedYesterday: (postedCreatives || []).map(c => ({
          headline: c.headline,
          narrator: c.narrator,
          city: c.city,
          contentType: c.content_type,
        })),
        items: (approvedCreatives || []).map(c => ({
          headline: c.headline,
          narrator: c.narrator,
          city: c.city,
          scheduledFor: c.scheduled_for,
          contentType: c.content_type,
          status: c.status,
        })),
      },
      creativeGrid,
    };

    const emailResult = skipEmail
      ? { success: false, error: 'skipped (skipEmail=true)' }
      : await sendMarketingDigest(digestData);

    const summary = {
      posts: publishedPosts.length,
      failedPosts: failedPostsList.length,
      newComments: comments.length,
      autoReplied: autoReplied.length,
      questionsForManual: questions.length,
      outreachOpportunities: (newOpps || []).length,
      communityVIPs: vips.length,
      healthStatus: healthOverall,
      gridHealthScore: creativeGrid?.score ?? null,
      emailSkipped: skipEmail,
      emailDelivered: emailResult.success,
      emailError: emailResult.error || null,
    };

    console.log(`[MARKETING-DIGEST] ${JSON.stringify(summary)}`);

    return NextResponse.json({
      success: true,
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MARKETING-DIGEST] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
