import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

export const maxDuration = 120; // 2 minutes — more work now with auto-replies

// ─── Sentiment Classification ──────────────────────────────────────────────

type Sentiment = 'positive' | 'question' | 'negative' | 'emoji_only' | 'spam' | 'share_request' | 'neutral';

function classifySentiment(text: string): Sentiment {
  const t = (text || '').trim();
  const lower = t.toLowerCase();

  // Emoji-only (hearts, fire, dogs, clapping, etc.)
  const stripped = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}\u{2702}-\u{27B0}\u{E0020}-\u{E007F}\s❤️♥️✨🔥💯👏🙌😍🥰💕💖💗💘💝🐶🐕🐩🐾🫶👍🤩😻]+/gu, '');
  if (stripped.length === 0 && t.length > 0) return 'emoji_only';

  // Spam signals
  if (/\b(dm me|check (my|our) (bio|page|profile)|free follow|click (the )?link|giveaway winner|make \$\d|earn money)\b/i.test(lower)) return 'spam';
  if ((lower.match(/@\w+/g) || []).length >= 3) return 'spam'; // Tagging spam

  // Share/repost requests — typically engagement farming accounts
  if (/\b(repost|re-post|share (this|on|it)|send (this|the) post|can we (share|repost|post)|dürfen wir das reposten|schick mir|send (it|this) to me|post (this|it) (on|to))\b/i.test(lower)) return 'share_request';
  if (/share on\s*✨/i.test(lower)) return 'share_request';

  // Questions
  if (/\?/.test(t) || /\b(where|what|how|when|which|can you|do you|is this|are they|does it|is it)\b/i.test(lower)) return 'question';

  // Negative
  if (/\b(hate|terrible|awful|worst|disgusting|rude|never going|don't go|avoid|overpriced|disappointing|scam)\b/i.test(lower)) return 'negative';

  // Positive signals
  if (/\b(love|amazing|awesome|beautiful|gorgeous|adorable|cute|great|fantastic|wonderful|perfect|best|incredible|lovely|sweet|happy|thank|congrats|so cool|obsessed)\b/i.test(lower)) return 'positive';
  if (/[❤️♥️🔥💯😍🥰💕🐶🐕🐾👏🙌🤩💖✨👍🫶😻]+/.test(t)) return 'positive';

  return 'neutral';
}

// ─── AI-Powered Reply Generation ──────────────────────────────────────────
// Uses GPT-4o-mini to analyze each comment's full intent, tone, and context
// then crafts a thoughtful, on-brand reply. No more template matching.

const BRAND_CONTEXT = `You are the social media voice for @thepawcities — a platform helping dog owners discover dog-friendly places in cities worldwide (Paris, London, NYC, LA, Barcelona, Geneva, Sydney, Tokyo).

BRAND MASCOTS: Buster & Marley are animated characters inspired by the founder's real dogs.
- Buster: a golden-tan mixed breed, the adventurer — enthusiastic, playful
- Marley: a golden-apricot goldendoodle, the brains — calm, clever, witty

VOICE: Warm, genuine, community-focused. Not corporate. Like talking to a fellow dog lover.

REPLY RULES:
- Read the comment carefully. Understand the FULL intent, emotion, and subtext — not just keywords.
- Match the energy of the comment. Short casual comments get short replies. Thoughtful comments get thoughtful replies.
- If someone is skeptical, critical, or sarcastic, NEVER be defensive. Acknowledge their point, then gently reframe positively.
- If someone questions AI-generated content, own it proudly — the mascots are animated on purpose so they can "travel" to any city. They're inspired by the founder's real dogs.
- If someone asks to share/repost, be gracious but always request credit/tag to @thepawcities.
- If someone asks a question about a city or place, give a helpful answer or point them to the bio link.
- Use 1-2 emojis naturally. Never overdo it.
- Keep replies under 150 characters for simple comments, up to 300 for substantive ones.
- NEVER sound like a bot. No "Thanks for engaging!" or generic corporate speak.
- Each reply must feel like it was written by a human who actually read the comment.

DO NOT REPLY (return exactly "SKIP") if the comment is:
- Obvious spam (DM me, check my bio, free followers, etc.)
- Just tagging other users with no substance
- In a language you cannot confidently reply in (reply in the comment's language if you can)

Return ONLY the reply text. No quotes, no explanation, no prefix.`;

async function generateAIReply(
  commentText: string,
  commentUsername: string,
  postCaption: string,
  sentiment: Sentiment,
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[ENGAGEMENT] No OPENAI_API_KEY — falling back to skip');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BRAND_CONTEXT },
          {
            role: 'user',
            content: `POST CAPTION (for context): "${postCaption.substring(0, 300)}"

COMMENT by @${commentUsername}: "${commentText}"

DETECTED SENTIMENT: ${sentiment}

Write a reply to this comment. Remember: read the full intent, not just keywords. If it should not be replied to, return exactly "SKIP".`,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply || reply === 'SKIP' || reply.toUpperCase() === 'SKIP') return null;

    // Safety: strip any quotes the model might wrap around the reply
    const cleaned = reply.replace(/^["']|["']$/g, '').trim();
    if (cleaned.length < 2 || cleaned.length > 500) return null;

    return cleaned;
  } catch (err) {
    console.error('[ENGAGEMENT] AI reply generation failed:', err);
    return null;
  }
}

// ─── Auto-Reply via Instagram Graph API ────────────────────────────────────

async function postReply(
  commentId: string,
  message: string,
  apiVersion: string,
  accessToken: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${commentId}/replies`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    if (data.error) {
      return { success: false, error: `${data.error.message} (code ${data.error.code})` };
    }

    return { success: true, replyId: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────

/**
 * Social Engagement Agent — Upgraded
 *
 * Runs daily at 10 AM UTC to:
 * 1. Pull engagement metrics (likes, reach, saves) for recent posts
 * 2. Fetch and classify ALL new comments (sentiment analysis)
 * 3. Auto-reply to positive/emoji/neutral comments (capped at 15/run)
 * 4. Flag questions and negatives for manual review
 * 5. Track community VIPs (repeat commenters)
 * 6. Store everything for the unified marketing digest
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const META_PAGE_ACCESS_TOKEN = getMetaToken();
  const INSTAGRAM_ACCOUNT_ID = getInstagramAccountId();
  const META_API_VERSION = getMetaApiVersion();
  const OUR_USERNAME = getInstagramUsername();

  if (!META_PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    return NextResponse.json({ error: 'Instagram API credentials not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  // Tracking counters
  let newCommentsFound = 0;
  let autoRepliesSent = 0;
  let autoReplyErrors = 0;
  let questionsFound = 0;
  let negativesFound = 0;
  let spamFound = 0;
  const MAX_AUTO_REPLIES_PER_RUN = 15;
  const replyErrors: string[] = [];

  try {
    // ─── 1. Fetch recent Instagram media ────────────────────────────
    const mediaResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${INSTAGRAM_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=25&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const mediaData = await mediaResponse.json();

    if (mediaData.error) {
      return NextResponse.json({ error: `Instagram API error: ${mediaData.error.message}` }, { status: 500 });
    }

    const posts = mediaData.data || [];
    const insights: { postId: string; likes: number; comments: number; permalink: string; timestamp: string; caption: string }[] = [];

    // ─── 2. Process each post: metrics + comments ───────────────────
    for (const post of posts) {
      // Get detailed insights
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
        // Insights not available for all posts
      }

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

      // Update metrics in social_posts
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

      // ─── 3. Fetch comments + classify + auto-reply ──────────────
      try {
        const commentsResponse = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${post.id}/comments?fields=id,text,username,timestamp&limit=50&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const commentsData = await commentsResponse.json();

        if (commentsData.data && commentsData.data.length > 0) {
          for (const comment of commentsData.data) {
            // Skip our own comments
            if (comment.username === OUR_USERNAME) continue;

            const sentiment = classifySentiment(comment.text);

            // Track sentiment stats
            if (sentiment === 'question') questionsFound++;
            if (sentiment === 'negative') negativesFound++;
            if (sentiment === 'spam') spamFound++;

            // Check if comment already exists
            const { data: existingComment } = await supabase
              .from('social_comments')
              .select('id, replied')
              .eq('comment_id', comment.id)
              .maybeSingle();

            if (existingComment) {
              // Update sentiment if not set
              await supabase
                .from('social_comments')
                .update({ sentiment })
                .eq('id', existingComment.id);
              continue; // Already processed
            }

            // New comment — insert it
            newCommentsFound++;

            await supabase
              .from('social_comments')
              .insert({
                comment_id: comment.id,
                post_id: post.id,
                username: comment.username,
                text: comment.text,
                commented_at: comment.timestamp,
                replied: false,
                sentiment,
              });

            // ─── Auto-reply logic (AI-powered) ─────────────────────
            if (autoRepliesSent >= MAX_AUTO_REPLIES_PER_RUN) continue;

            // Skip spam — AI handles everything else including questions & nuanced comments
            if (sentiment === 'spam') continue;

            const replyText = await generateAIReply(
              comment.text,
              comment.username,
              post.caption || '',
              sentiment,
            );
            if (!replyText) continue; // AI decided to skip or generation failed

            // Only auto-reply to comments less than 48 hours old
            const commentAge = Date.now() - new Date(comment.timestamp).getTime();
            if (commentAge > 48 * 60 * 60 * 1000) continue;

            // Post the reply
            const replyResult = await postReply(
              comment.id,
              replyText,
              META_API_VERSION,
              META_PAGE_ACCESS_TOKEN
            );

            if (replyResult.success) {
              autoRepliesSent++;
              // Mark as replied in DB
              await supabase
                .from('social_comments')
                .update({
                  replied: true,
                  reply_text: replyText,
                  replied_at: new Date().toISOString(),
                })
                .eq('comment_id', comment.id);

              console.log(`[ENGAGEMENT] Auto-replied to @${comment.username}: "${replyText.substring(0, 50)}..."`);
            } else {
              autoReplyErrors++;
              replyErrors.push(`@${comment.username}: ${replyResult.error}`);
              console.error(`[ENGAGEMENT] Reply failed for @${comment.username}: ${replyResult.error}`);
            }

            // Rate limit between replies (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } catch (err) {
        console.error(`[ENGAGEMENT] Comments fetch failed for post ${post.id}:`, err);
      }

      // Rate limiting between posts
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ─── 4. Community Intelligence ──────────────────────────────────
    // Find VIP commenters (3+ comments across our posts)
    const { data: vipCommenters } = await supabase
      .from('social_comments')
      .select('username')
      .neq('username', OUR_USERNAME);

    const commentCounts: Record<string, number> = {};
    if (vipCommenters) {
      for (const c of vipCommenters) {
        commentCounts[c.username] = (commentCounts[c.username] || 0) + 1;
      }
    }
    const vips = Object.entries(commentCounts)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .map(([username, count]) => ({ username, commentCount: count }));

    // New commenters in the last 24 hours (first-time engagers)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCommenters } = await supabase
      .from('social_comments')
      .select('username')
      .gte('commented_at', oneDayAgo)
      .neq('username', OUR_USERNAME);

    const newCommenters = recentCommenters
      ? [...new Set(recentCommenters.map(c => c.username))].filter(
          username => (commentCounts[username] || 0) <= 1
        )
      : [];

    // ─── 5. Performance summary ─────────────────────────────────────
    const totalLikes = insights.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = insights.reduce((sum, p) => sum + p.comments, 0);
    const topPost = insights.sort((a, b) => (b.likes + b.comments * 3) - (a.likes + a.comments * 3))[0];

    const { data: unreplied } = await supabase
      .from('social_comments')
      .select('*')
      .eq('replied', false)
      .in('sentiment', ['question', 'negative'])
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
      newCommentsFound,
      autoRepliesSent,
      autoReplyErrors,
      questionsNeedingReply: questionsFound,
      negativesNeedingReview: negativesFound,
      spamDetected: spamFound,
      unrepliedManualItems: (unreplied || []).length,
      communityVIPs: vips.slice(0, 10),
      newCommentersToday: newCommenters.length,
      replyErrors: replyErrors.length > 0 ? replyErrors : undefined,
    };

    console.log(`[ENGAGEMENT] Complete: ${newCommentsFound} new comments, ${autoRepliesSent} auto-replies, ${questionsFound} questions flagged, ${vips.length} VIPs`);

    return NextResponse.json({
      success: true,
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ENGAGEMENT] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
