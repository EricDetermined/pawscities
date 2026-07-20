export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const supabase = authResult.supabase!;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();
    const fourteenDaysAgoISO = fourteenDaysAgo.toISOString();

    // Run all queries in parallel for speed
    const [
      socialPostsResult,
      creativeQueueResult,
      eventsResult,
      socialCommentsResult,
      opportunitiesResult,
    ] = await Promise.all([
      // 1. Social Posts (last 30 days)
      safeQuery(() =>
        supabase
          .from('social_posts')
          .select('id, status, city, headline, content_type, likes, comments_count, engagement_score, created_at, posted_at')
          .gte('created_at', thirtyDaysAgoISO)
          .order('created_at', { ascending: true })
      ),

      // 2. Creative Queue (all)
      safeQuery(() =>
        supabase
          .from('creative_queue')
          .select('id, status, city, content_type, created_at')
      ),

      // 3. Events Pipeline (last 30 days)
      safeQuery(() =>
        supabase
          .from('events')
          .select('id, status, city_id, created_at')
          .gte('created_at', thirtyDaysAgoISO)
      ),

      // 4. Social Comments (last 30 days)
      safeQuery(() =>
        supabase
          .from('social_comments')
          .select('id, sentiment, replied, commented_at')
          .gte('commented_at', thirtyDaysAgoISO)
      ),

      // 5. Engagement Outreach
      safeQuery(() =>
        supabase
          .from('social_opportunities')
          .select('id, status, category, created_at')
      ),
    ]);

    const socialPosts: any[] = socialPostsResult;
    const creativeQueue: any[] = creativeQueueResult;
    const events: any[] = eventsResult;
    const socialComments: any[] = socialCommentsResult;
    const opportunities: any[] = opportunitiesResult;

    // ── Process Social Posts ──────────────────────────────────────────

    const postedPosts = socialPosts.filter((p) => p.status === 'posted' || p.posted_at);
    const totalPosted = postedPosts.length;

    const avgLikes = totalPosted > 0
      ? round(postedPosts.reduce((sum, p) => sum + (p.likes || 0), 0) / totalPosted)
      : 0;
    const avgComments = totalPosted > 0
      ? round(postedPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0) / totalPosted)
      : 0;
    const avgEngagement = totalPosted > 0
      ? round(postedPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / totalPosted)
      : 0;

    // Posts per day
    const postsByDayMap: Record<string, { count: number; totalEngagement: number }> = {};
    socialPosts.forEach((p) => {
      const date = toDateString(p.created_at);
      if (!postsByDayMap[date]) postsByDayMap[date] = { count: 0, totalEngagement: 0 };
      postsByDayMap[date].count++;
      postsByDayMap[date].totalEngagement += p.engagement_score || 0;
    });
    const postsByDay = Object.entries(postsByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        count: v.count,
        avgEngagement: v.count > 0 ? round(v.totalEngagement / v.count) : 0,
      }));

    // Posts by city
    const postsByCity: Record<string, number> = {};
    socialPosts.forEach((p) => {
      const city = p.city || 'Unknown';
      postsByCity[city] = (postsByCity[city] || 0) + 1;
    });

    // Posts by content type
    const postsByType: Record<string, number> = {};
    socialPosts.forEach((p) => {
      const type = p.content_type || 'Unknown';
      postsByType[type] = (postsByType[type] || 0) + 1;
    });

    // Top 5 posts by engagement
    const topPosts = [...socialPosts]
      .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        headline: p.headline,
        city: p.city,
        likes: p.likes || 0,
        comments_count: p.comments_count || 0,
        engagement_score: p.engagement_score || 0,
        created_at: p.created_at,
      }));

    // Daily engagement trend (avg likes and comments per day)
    const engagementByDayMap: Record<string, { totalLikes: number; totalComments: number; count: number }> = {};
    postedPosts.forEach((p) => {
      const date = toDateString(p.posted_at || p.created_at);
      if (!engagementByDayMap[date]) engagementByDayMap[date] = { totalLikes: 0, totalComments: 0, count: 0 };
      engagementByDayMap[date].totalLikes += p.likes || 0;
      engagementByDayMap[date].totalComments += p.comments_count || 0;
      engagementByDayMap[date].count++;
    });
    const dailyEngagement = Object.entries(engagementByDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        avgLikes: v.count > 0 ? round(v.totalLikes / v.count) : 0,
        avgComments: v.count > 0 ? round(v.totalComments / v.count) : 0,
      }));

    // ── Process Creative Queue ────────────────────────────────────────

    const queueByStatus = {
      queued: 0,
      posted: 0,
      failed: 0,
      needsReview: 0,
      total: creativeQueue.length,
    };
    creativeQueue.forEach((item) => {
      const s = (item.status || '').toLowerCase();
      if (s === 'queued') queueByStatus.queued++;
      else if (s === 'posted') queueByStatus.posted++;
      else if (s === 'failed') queueByStatus.failed++;
      else if (s === 'needs_review' || s === 'needs review') queueByStatus.needsReview++;
    });

    const queueByCity: Record<string, number> = {};
    creativeQueue.forEach((item) => {
      const city = item.city || 'Unknown';
      queueByCity[city] = (queueByCity[city] || 0) + 1;
    });

    // ── Process Events ────────────────────────────────────────────────

    const eventsByStatus = { approved: 0, pending: 0, rejected: 0 };
    events.forEach((e) => {
      const s = (e.status || '').toUpperCase();
      if (s === 'APPROVED') eventsByStatus.approved++;
      else if (s === 'PENDING') eventsByStatus.pending++;
      else if (s === 'REJECTED') eventsByStatus.rejected++;
    });

    const newThisWeek = events.filter(
      (e) => new Date(e.created_at) >= sevenDaysAgo
    ).length;
    const newLastWeek = events.filter(
      (e) => new Date(e.created_at) >= fourteenDaysAgo && new Date(e.created_at) < sevenDaysAgo
    ).length;

    // ── Process Social Comments ───────────────────────────────────────

    const totalCommentsReceived = socialComments.length;
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    socialComments.forEach((c) => {
      const s = (c.sentiment || 'neutral').toLowerCase();
      if (s === 'positive') sentimentBreakdown.positive++;
      else if (s === 'negative') sentimentBreakdown.negative++;
      else sentimentBreakdown.neutral++;
    });

    const repliedCount = socialComments.filter((c) => c.replied === true).length;
    const replyRate = totalCommentsReceived > 0
      ? round(repliedCount / totalCommentsReceived, 4)
      : 0;

    // ── Process Opportunities ─────────────────────────────────────────

    const opportunityStats = { total: opportunities.length, new: 0, replied: 0, skipped: 0 };
    opportunities.forEach((o) => {
      const s = (o.status || '').toLowerCase();
      if (s === 'new') opportunityStats.new++;
      else if (s === 'replied') opportunityStats.replied++;
      else if (s === 'skipped') opportunityStats.skipped++;
    });

    // ── Generate Insights ─────────────────────────────────────────────

    const insights: string[] = [];

    // Check engagement trend
    if (dailyEngagement.length >= 14) {
      const recentHalf = dailyEngagement.slice(-7);
      const olderHalf = dailyEngagement.slice(-14, -7);
      const recentAvg = recentHalf.reduce((s, d) => s + d.avgLikes, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((s, d) => s + d.avgLikes, 0) / olderHalf.length;
      if (olderAvg > 0 && recentAvg < olderAvg * 0.8) {
        insights.push(
          `Engagement is declining: avg likes dropped ${Math.round((1 - recentAvg / olderAvg) * 100)}% over the last week. Consider refreshing content themes or experimenting with new formats.`
        );
      } else if (olderAvg > 0 && recentAvg > olderAvg * 1.2) {
        insights.push(
          `Engagement is trending up: avg likes increased ${Math.round((recentAvg / olderAvg - 1) * 100)}% over the last week. Keep momentum with similar content.`
        );
      }
    }

    // Check city coverage gaps
    const cityEntries = Object.entries(postsByCity).sort(([, a], [, b]) => a - b);
    if (cityEntries.length > 1) {
      const lowestCity = cityEntries[0];
      const highestCity = cityEntries[cityEntries.length - 1];
      if (highestCity[1] > 0 && lowestCity[1] < highestCity[1] * 0.3) {
        insights.push(
          `${lowestCity[0]} has only ${lowestCity[1]} posts vs ${highestCity[1]} for ${highestCity[0]}. Consider increasing content coverage for underserved cities.`
        );
      }
    }

    // Check content queue health
    const remainingQueued = queueByStatus.queued;
    if (remainingQueued < 5) {
      insights.push(
        `Content supply is low: only ${remainingQueued} items queued. Generate more content to avoid gaps in the posting schedule.`
      );
    }

    // Check reply rate
    if (totalCommentsReceived > 5 && replyRate < 0.5) {
      insights.push(
        `Community reply rate is ${Math.round(replyRate * 100)}%. Responding to more comments can boost engagement and audience loyalty.`
      );
    }

    // Check top-performing content type
    if (Object.keys(postsByType).length > 1 && postedPosts.length > 0) {
      const typeEngagement: Record<string, { total: number; count: number }> = {};
      postedPosts.forEach((p) => {
        const type = p.content_type || 'Unknown';
        if (!typeEngagement[type]) typeEngagement[type] = { total: 0, count: 0 };
        typeEngagement[type].total += p.engagement_score || 0;
        typeEngagement[type].count++;
      });
      const typeAvgs = Object.entries(typeEngagement)
        .map(([type, v]) => ({ type, avg: v.count > 0 ? v.total / v.count : 0, count: v.count }))
        .filter((t) => t.count >= 3)
        .sort((a, b) => b.avg - a.avg);

      if (typeAvgs.length >= 2) {
        const best = typeAvgs[0];
        const secondBest = typeAvgs[1];
        if (secondBest.avg > 0 && best.avg > secondBest.avg * 1.3) {
          insights.push(
            `"${best.type}" content outperforms others by ${Math.round((best.avg / secondBest.avg - 1) * 100)}% on engagement. Consider doubling down on this format.`
          );
        }
      }
    }

    // Check failed queue items
    if (queueByStatus.failed > 3) {
      insights.push(
        `${queueByStatus.failed} items in the creative queue have failed. Review and retry or remove them to keep the pipeline clean.`
      );
    }

    // Check event pipeline
    if (newThisWeek > 0 && newLastWeek > 0 && newThisWeek > newLastWeek * 1.5) {
      insights.push(
        `Event submissions surged ${Math.round((newThisWeek / newLastWeek - 1) * 100)}% this week (${newThisWeek} vs ${newLastWeek} last week). Ensure the review pipeline can keep up.`
      );
    }

    // Ensure at least 3 insights
    if (insights.length < 3) {
      if (totalPosted > 0) {
        insights.push(
          `${totalPosted} posts published in the last 30 days with an average engagement score of ${avgEngagement}. Track week-over-week trends to identify what resonates.`
        );
      }
      if (insights.length < 3 && opportunityStats.total > 0) {
        const actionedRate = opportunityStats.total > 0
          ? Math.round(((opportunityStats.replied + opportunityStats.skipped) / opportunityStats.total) * 100)
          : 0;
        insights.push(
          `${actionedRate}% of engagement opportunities have been actioned. Stay on top of new opportunities to build community presence.`
        );
      }
      if (insights.length < 3) {
        insights.push(
          `Review the pipeline: ${eventsByStatus.pending} events pending approval and ${queueByStatus.needsReview} creative items need review.`
        );
      }
    }

    // ── Build Response ────────────────────────────────────────────────

    return NextResponse.json({
      period: {
        start: thirtyDaysAgoISO,
        end: now.toISOString(),
      },
      social: {
        totalPosted,
        avgLikes,
        avgComments,
        avgEngagement,
        postsByDay,
        postsByCity,
        postsByType,
        topPosts,
        dailyEngagement,
      },
      pipeline: {
        creativeQueue: queueByStatus,
        queueByCity,
        events: {
          approved: eventsByStatus.approved,
          pending: eventsByStatus.pending,
          rejected: eventsByStatus.rejected,
          newThisWeek,
          newLastWeek,
        },
      },
      community: {
        totalComments: totalCommentsReceived,
        sentimentBreakdown,
        replyRate,
        opportunities: opportunityStats,
      },
      insights,
    });
  } catch (error: any) {
    console.error('Admin analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Safely execute a Supabase query, returning an empty array on any error. */
async function safeQuery(
  queryFn: () => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.warn('Analytics query warning:', error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.warn('Analytics query exception:', err.message);
    return [];
  }
}

/** Convert an ISO date string to YYYY-MM-DD. */
function toDateString(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0];
}

/** Round a number to the given decimal places (default 2). */
function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
