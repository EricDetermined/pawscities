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

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. SYSTEM HEALTH — Quick inline checks
    // ═══════════════════════════════════════════════════════════════
    const healthChecks: { name: string; status: 'healthy' | 'warning' | 'critical'; message: string }[] = [];

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

    const { data: recentPosts } = await supabase
      .from('social_posts')
      .select('headline, city, likes, comments_count, permalink, post_id')
      .eq('status', 'published')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });

    const publishedPosts = (recentPosts || []).map(p => ({
      headline: p.headline || 'Untitled',
      city: p.city || 'unknown',
      likes: p.likes || 0,
      comments: p.comments_count || 0,
      permalink: p.permalink || `https://instagram.com/p/${p.post_id || ''}`,
    }));

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
      .select('likes, comments_count, permalink, caption, engagement_score')
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

    if ((newEventCount || 0) > 0 || (pendingEventCount || 0) > 0) {
      eventsData = {
        newDiscovered: newEventCount || 0,
        pendingReview: pendingEventCount || 0,
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
          permalink: topPost.permalink || '',
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
    };

    const emailResult = await sendMarketingDigest(digestData);

    const summary = {
      posts: publishedPosts.length,
      failedPosts: failedPostsList.length,
      newComments: comments.length,
      autoReplied: autoReplied.length,
      questionsForManual: questions.length,
      outreachOpportunities: (newOpps || []).length,
      communityVIPs: vips.length,
      healthStatus: healthOverall,
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
