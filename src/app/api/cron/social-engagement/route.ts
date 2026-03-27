import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET;
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 60;

/**
 * Social Engagement Tracking Agent
 *
 * Runs daily to:
 * 1. Pull engagement metrics for recent Instagram posts
 * 2. Identify top-performing content
 * 3. Fetch and store new comments for community engagement
 * 4. Calculate performance scores for A/B testing
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!META_PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    return NextResponse.json({ error: 'Instagram API credentials not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Fetch recent Instagram media
    const mediaResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=25&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const mediaData = await mediaResponse.json();

    if (mediaData.error) {
      return NextResponse.json({ error: `Instagram API error: ${mediaData.error.message}` }, { status: 500 });
    }

    const posts = mediaData.data || [];
    const insights: { postId: string; likes: number; comments: number; permalink: string; timestamp: string; caption: string }[] = [];

    // 2. Get insights for each post
    for (const post of posts) {
      // Try to get detailed insights (reach, impressions, saves)
      let reach = 0;
      let impressions = 0;
      let saved = 0;

      try {
        const insightResponse = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${post.id}/insights?metric=reach,impressions,saved&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const insightData = await insightResponse.json();

        if (insightData.data) {
          for (const metric of insightData.data) {
            if (metric.name === 'reach') reach = metric.values?.[0]?.value || 0;
            if (metric.name === 'impressions') impressions = metric.values?.[0]?.value || 0;
            if (metric.name === 'saved') saved = metric.values?.[0]?.value || 0;
          }
        }
      } catch {
        // Insights not available for all posts (e.g., older posts)
      }

      // Calculate engagement score (weighted)
      const engagementScore = (post.like_count || 0) * 1
        + (post.comments_count || 0) * 3
        + saved * 5
        + (reach > 0 ? ((post.like_count + post.comments_count) / reach) * 100 : 0);

      insights.push({
        postId: post.id,
        likes: post.like_count || 0,
        comments: post.comments_count || 0,
        permalink: post.permalink,
        timestamp: post.timestamp,
        caption: (post.caption || '').substring(0, 200),
      });

      // Store/update in social_posts table if we can match by post_id
      const { data: existingPost } = await supabase
        .from('social_posts')
        .select('id')
        .eq('post_id', post.id)
        .maybeSingle();

      if (existingPost) {
        await supabase
          .from('social_posts')
          .update({
            likes: post.like_count || 0,
            comments_count: post.comments_count || 0,
            reach,
            impressions,
            saves: saved,
            engagement_score: Math.round(engagementScore * 10) / 10,
            insights_updated_at: new Date().toISOString(),
          })
          .eq('id', existingPost.id);
      }

      // 3. Fetch comments for community monitoring
      try {
        const commentsResponse = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${post.id}/comments?fields=id,text,username,timestamp&limit=10&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const commentsData = await commentsResponse.json();

        if (commentsData.data && commentsData.data.length > 0) {
          for (const comment of commentsData.data) {
            // Store new comments (upsert by comment ID)
            await supabase
              .from('social_comments')
              .upsert({
                comment_id: comment.id,
                post_id: post.id,
                username: comment.username,
                text: comment.text,
                commented_at: comment.timestamp,
                replied: false,
              }, { onConflict: 'comment_id' })
              .select();
          }
        }
      } catch {
        // Comments fetch failed, continue
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4. Calculate performance summary
    const totalLikes = insights.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = insights.reduce((sum, p) => sum + p.comments, 0);
    const topPost = insights.sort((a, b) => (b.likes + b.comments * 3) - (a.likes + a.comments * 3))[0];

    // 5. Identify unreplied comments needing attention
    const { data: unreplied } = await supabase
      .from('social_comments')
      .select('*')
      .eq('replied', false)
      .order('commented_at', { ascending: false })
      .limit(10);

    const summary = {
      postsTracked: insights.length,
      totalLikes,
      totalComments,
      avgLikesPerPost: insights.length > 0 ? Math.round(totalLikes / insights.length) : 0,
      avgCommentsPerPost: insights.length > 0 ? Math.round((totalComments / insights.length) * 10) / 10 : 0,
      topPerformingPost: topPost ? {
        permalink: topPost.permalink,
        likes: topPost.likes,
        comments: topPost.comments,
        caption: topPost.caption,
      } : null,
      unrepliedComments: (unreplied || []).length,
    };

    console.log('Social engagement tracking complete:', summary);

    return NextResponse.json({
      success: true,
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Social engagement tracking error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
