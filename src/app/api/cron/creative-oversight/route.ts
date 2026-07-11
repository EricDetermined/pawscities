import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';

// ─── Config ────────────────────────────────────────────────────────────────────

export const maxDuration = 60;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/creative-oversight
//
// Creative Quality & Diversity Oversight Agent
//
// Runs daily to audit the creative pipeline for visual repetition issues:
//   1. Check approved/pending creatives for duplicate photo IDs
//   2. Check recent posted grid for format monotony (3+ same style in a row)
//   3. Check upcoming queue for photo clustering (same photo used twice)
//   4. Flag issues and auto-regenerate when possible
//   5. Report summary of grid health
//
// Can also be triggered manually: ?secret=CRON_SECRET
// ═══════════════════════════════════════════════════════════════════════════════

interface GridIssue {
  type: 'duplicate_photo' | 'format_monotony' | 'photo_cluster' | 'stale_creative';
  severity: 'high' | 'medium' | 'low';
  description: string;
  creativeIds?: string[];
  action?: string;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const issues: GridIssue[] = [];
    const actions: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    // ══════════════════════════════════════════════════════════════════════════
    // 1. AUDIT RECENT POSTS: Check for format monotony on the grid
    // ══════════════════════════════════════════════════════════════════════════

    const { data: recentPosts } = await supabase
      .from('social_posts')
      .select('id, headline, format, photo_id, image_url, created_at, city')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(12);

    if (recentPosts && recentPosts.length >= 3) {
      // Check for 3+ consecutive same format
      for (let i = 0; i <= recentPosts.length - 3; i++) {
        const formats = [recentPosts[i].format, recentPosts[i + 1].format, recentPosts[i + 2].format];
        if (formats[0] && formats[0] === formats[1] && formats[1] === formats[2]) {
          issues.push({
            type: 'format_monotony',
            severity: 'high',
            description: `${formats[0]} format used 3+ times in a row (posts ${i + 1}-${i + 3} on grid)`,
            creativeIds: [recentPosts[i].id, recentPosts[i + 1].id, recentPosts[i + 2].id],
          });
          break; // Only report the first instance
        }
      }

      // Check for duplicate photo IDs in recent 12 posts
      const photoIds = recentPosts.map(p => p.photo_id).filter(Boolean);
      const photoCounts = new Map<string, number>();
      for (const pid of photoIds) {
        photoCounts.set(pid, (photoCounts.get(pid) || 0) + 1);
      }
      for (const [photoId, count] of photoCounts) {
        if (count >= 2) {
          const affectedPosts = recentPosts.filter(p => p.photo_id === photoId);
          issues.push({
            type: 'duplicate_photo',
            severity: count >= 3 ? 'high' : 'medium',
            description: `Same dog photo (${photoId.slice(0, 20)}...) used ${count} times in last 12 posts: ${affectedPosts.map(p => `"${p.headline}"`).join(', ')}`,
            creativeIds: affectedPosts.map(p => p.id),
          });
        }
      }

      // Extract photo IDs from image_url for posts without explicit photo_id
      const urlPhotoIds = recentPosts
        .filter(p => !p.photo_id && p.image_url)
        .map(p => {
          const match = (p.image_url as string).match(/images\.unsplash\.com\/(photo-[^?]+)/);
          return match ? { id: p.id, photoId: match[1], headline: p.headline } : null;
        })
        .filter(Boolean) as { id: string; photoId: string; headline: string }[];

      if (urlPhotoIds.length > 0) {
        const urlPhotoCounts = new Map<string, { count: number; posts: string[] }>();
        for (const item of urlPhotoIds) {
          const existing = urlPhotoCounts.get(item.photoId) || { count: 0, posts: [] };
          existing.count++;
          existing.posts.push(item.headline);
          urlPhotoCounts.set(item.photoId, existing);
        }
        for (const [photoId, { count, posts }] of urlPhotoCounts) {
          if (count >= 2) {
            issues.push({
              type: 'duplicate_photo',
              severity: 'medium',
              description: `Same Unsplash photo (${photoId.slice(0, 20)}...) detected in ${count} recent posts via URL: ${posts.join(', ')}`,
            });
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. AUDIT PENDING QUEUE: Check upcoming creatives for diversity
    // ══════════════════════════════════════════════════════════════════════════

    const { data: pendingCreatives } = await supabase
      .from('creative_queue')
      .select('id, headline, format, image_url, city, scheduled_for, content_type')
      .in('status', ['approved', 'pending_review'])
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (pendingCreatives && pendingCreatives.length > 0) {
      // Check for format clustering in upcoming queue
      const formatCounts = new Map<string, number>();
      for (const c of pendingCreatives) {
        const fmt = c.format || 'unknown';
        formatCounts.set(fmt, (formatCounts.get(fmt) || 0) + 1);
      }
      for (const [fmt, count] of formatCounts) {
        const pct = Math.round((count / pendingCreatives.length) * 100);
        if (pct > 70 && pendingCreatives.length >= 5) {
          issues.push({
            type: 'format_monotony',
            severity: 'medium',
            description: `${pct}% of upcoming queue (${count}/${pendingCreatives.length}) uses "${fmt}" format — grid will look monotonous`,
          });
        }
      }

      // Check for duplicate photos in pending queue
      const pendingPhotoIds = pendingCreatives
        .map(c => {
          if (!c.image_url) return null;
          const match = (c.image_url as string).match(/images\.unsplash\.com\/(photo-[^?]+)/);
          return match ? { id: c.id, photoId: match[1], headline: c.headline } : null;
        })
        .filter(Boolean) as { id: string; photoId: string; headline: string }[];

      const pendingPhotoCounts = new Map<string, { ids: string[]; headlines: string[] }>();
      for (const item of pendingPhotoIds) {
        const existing = pendingPhotoCounts.get(item.photoId) || { ids: [], headlines: [] };
        existing.ids.push(item.id);
        existing.headlines.push(item.headline);
        pendingPhotoCounts.set(item.photoId, existing);
      }

      for (const [photoId, { ids, headlines }] of pendingPhotoCounts) {
        if (ids.length >= 2) {
          issues.push({
            type: 'photo_cluster',
            severity: 'high',
            description: `Same dog photo (${photoId.slice(0, 20)}...) queued for ${ids.length} upcoming posts: ${headlines.join(', ')}`,
            creativeIds: ids,
            action: 'regenerate_duplicates',
          });
        }
      }

      // Cross-check: pending photos that also appear in recent posts
      if (recentPosts) {
        const recentPhotoSet = new Set(
          recentPosts
            .map(p => {
              if (p.photo_id) return p.photo_id;
              if (!p.image_url) return null;
              const match = (p.image_url as string).match(/images\.unsplash\.com\/(photo-[^?]+)/);
              return match ? match[1] : null;
            })
            .filter(Boolean)
        );

        for (const item of pendingPhotoIds) {
          if (recentPhotoSet.has(item.photoId)) {
            issues.push({
              type: 'duplicate_photo',
              severity: 'high',
              description: `Pending creative "${item.headline}" uses same photo as a recent post — will look repetitive on grid`,
              creativeIds: [item.id],
              action: 'regenerate',
            });
          }
        }
      }

      // Check for stale event creatives
      for (const c of pendingCreatives) {
        if (c.content_type === 'event' && c.scheduled_for && c.scheduled_for < today) {
          issues.push({
            type: 'stale_creative',
            severity: 'low',
            description: `Creative "${c.headline}" was scheduled for ${c.scheduled_for} but hasn't been posted`,
            creativeIds: [c.id],
          });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. GRID HEALTH SCORE
    // ══════════════════════════════════════════════════════════════════════════

    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    // Score: 100 = perfect, deduct for issues
    let gridHealthScore = 100;
    gridHealthScore -= highIssues * 20;
    gridHealthScore -= mediumIssues * 10;
    gridHealthScore -= lowIssues * 3;
    gridHealthScore = Math.max(0, gridHealthScore);

    const gridHealth = gridHealthScore >= 80 ? 'healthy' : gridHealthScore >= 50 ? 'needs_attention' : 'poor';

    // ══════════════════════════════════════════════════════════════════════════
    // 4. AUTO-ACTIONS: Flag issues that need human review
    // ══════════════════════════════════════════════════════════════════════════

    // For now, log issues. In the future, auto-regenerate flagged creatives.
    for (const issue of issues) {
      if (issue.action === 'regenerate' && issue.creativeIds?.length) {
        // Mark the creative as needing regeneration
        for (const cid of issue.creativeIds) {
          await supabase
            .from('creative_queue')
            .update({
              status: 'pending_review',
              error_message: `[OVERSIGHT] ${issue.description}`,
            })
            .eq('id', cid)
            .eq('status', 'approved'); // Only downgrade approved items
        }
        actions.push(`Flagged ${issue.creativeIds.length} creative(s) for review: ${issue.description}`);
      }
    }

    console.log(`[CREATIVE-OVERSIGHT] Grid health: ${gridHealth} (${gridHealthScore}/100) — ${issues.length} issues found, ${actions.length} actions taken`);

    return NextResponse.json({
      status: 'ok',
      gridHealth,
      gridHealthScore,
      summary: {
        recentPostsAudited: recentPosts?.length || 0,
        pendingCreativesAudited: pendingCreatives?.length || 0,
        issuesFound: issues.length,
        highSeverity: highIssues,
        mediumSeverity: mediumIssues,
        lowSeverity: lowIssues,
        actionsTaken: actions.length,
      },
      issues,
      actions,
    });

  } catch (error) {
    console.error('[CREATIVE-OVERSIGHT] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
