import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth } from '@/lib/cron-auth';
// Email sending moved to the unified marketing-digest cron
// Read at request time, not build time — avoids empty-string caching on Vercel
function getMetaToken() { return process.env.META_PAGE_ACCESS_TOKEN; }
function getInstagramAccountId() { return process.env.INSTAGRAM_ACCOUNT_ID; }
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v21.0'; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 120; // 2 minutes

// Rotate through 4 hashtags per day (stay well within 30/week API limit)
// Each day picks a different slice using day-of-year modulo
const ALL_HASHTAGS = [
  'dogfriendly',
  'dogfriendlyrestaurant',
  'dogfriendlycafe',
  'dogfriendlyhotel',
  'petfriendly',
  'dogtravel',
  'travelwithdog',
  'dogfriendlylondon',
  'dogfriendlyparis',
  'dogfriendlybarcelona',
  'dogfriendlynyc',
  'dogfriendlyla',
  'dogsofinstagram',
  'doglovers',
  'pawcities',
];

const HASHTAGS_PER_RUN = 4; // 4/day — stay well within Meta's rate limits

interface HashtagMedia {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

/**
 * Agent 4: Community Outreach Monitor
 *
 * Runs daily to:
 * 1. Search niche hashtags for trending posts (rotated to respect API limits)
 * 2. Surface engagement opportunities (lower thresholds for niche community)
 * 3. Track watchlist accounts for new content
 * 4. Draft suggested engagement responses for admin review
 * 5. ALWAYS send a daily digest email with actionable intelligence
 *
 * Uses Instagram Graph API hashtag search (business accounts only)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const META_PAGE_ACCESS_TOKEN = getMetaToken();
  const INSTAGRAM_ACCOUNT_ID = getInstagramAccountId();
  const META_API_VERSION = getMetaApiVersion();

  if (!META_PAGE_ACCESS_TOKEN || !INSTAGRAM_ACCOUNT_ID) {
    console.error('[OUTREACH] Instagram API credentials not configured');
    return NextResponse.json({ error: 'Instagram API credentials not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  let opportunities = 0;
  let hashtagsScanned = 0;
  let hashtagErrors: string[] = [];
  let watchlistChecked = 0;
  let watchlistErrors: string[] = [];

  try {
    // 1. Pick today's hashtag rotation slice
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const startIdx = (dayOfYear * HASHTAGS_PER_RUN) % ALL_HASHTAGS.length;

    // Merge with any custom hashtags from DB
    let allHashtags = [...ALL_HASHTAGS];
    const { data: customHashtags } = await supabase
      .from('social_watchlist')
      .select('hashtag')
      .eq('type', 'hashtag')
      .eq('active', true);

    if (customHashtags && customHashtags.length > 0) {
      const custom = customHashtags.map((h: { hashtag: string }) => h.hashtag).filter(Boolean);
      allHashtags = [...new Set([...custom, ...ALL_HASHTAGS])];
    }

    // Rotate: pick HASHTAGS_PER_RUN starting from today's offset
    const todaysHashtags: string[] = [];
    for (let i = 0; i < HASHTAGS_PER_RUN; i++) {
      todaysHashtags.push(allHashtags[(startIdx + i) % allHashtags.length]);
    }

    console.log(`[OUTREACH] Day ${dayOfYear}: scanning hashtags [${todaysHashtags.join(', ')}]`);

    // 2. Search hashtags for recent top posts
    for (const tag of todaysHashtags) {
      try {
        // Get hashtag ID
        const hashtagSearchRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/ig_hashtag_search?q=${encodeURIComponent(tag)}&user_id=${INSTAGRAM_ACCOUNT_ID}&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const hashtagSearchData = await hashtagSearchRes.json();

        if (hashtagSearchData.error) {
          const errMsg = `#${tag}: ${hashtagSearchData.error.message} (code ${hashtagSearchData.error.code})`;
          console.error(`[OUTREACH] Hashtag search error - ${errMsg}`);
          hashtagErrors.push(errMsg);
          continue;
        }

        if (!hashtagSearchData.data?.[0]?.id) {
          console.log(`[OUTREACH] No hashtag ID found for #${tag}`);
          hashtagErrors.push(`#${tag}: no results returned`);
          continue;
        }

        const hashtagId = hashtagSearchData.data[0].id;

        // Get top media for this hashtag
        const mediaRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/top_media?user_id=${INSTAGRAM_ACCOUNT_ID}&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const mediaData = await mediaRes.json();

        if (mediaData.error) {
          const errMsg = `#${tag} media: ${mediaData.error.message}`;
          console.error(`[OUTREACH] ${errMsg}`);
          hashtagErrors.push(errMsg);
          continue;
        }

        if (mediaData.data && mediaData.data.length > 0) {
          // LOWERED thresholds for niche community — 10+ likes OR 2+ comments
          const topPosts: HashtagMedia[] = mediaData.data
            .filter((post: HashtagMedia) => {
              const likes = post.like_count || 0;
              const comments = post.comments_count || 0;
              return likes >= 10 || comments >= 2;
            })
            .slice(0, 12); // Top 12 per hashtag — more opportunities per scan

          console.log(`[OUTREACH] #${tag}: ${mediaData.data.length} total posts, ${topPosts.length} above threshold`);

          for (const post of topPosts) {
            // Check if we've already tracked this opportunity (use maybeSingle to avoid crash)
            const { data: existing } = await supabase
              .from('social_opportunities')
              .select('id')
              .eq('media_id', post.id)
              .maybeSingle();

            if (!existing) {
              const caption = (post.caption || '').toLowerCase();
              let category = 'general';
              if (caption.includes('restaurant') || caption.includes('cafe') || caption.includes('brunch') || caption.includes('food')) category = 'food';
              else if (caption.includes('park') || caption.includes('hike') || caption.includes('trail') || caption.includes('beach') || caption.includes('walk')) category = 'outdoors';
              else if (caption.includes('hotel') || caption.includes('travel') || caption.includes('vacation') || caption.includes('flight') || caption.includes('trip')) category = 'travel';
              else if (caption.includes('rescue') || caption.includes('adopt') || caption.includes('shelter') || caption.includes('foster')) category = 'rescue';

              // Flag high-engagement posts as potential story reposts
              const isStoryWorthy = (post.like_count || 0) >= 100 || (post.comments_count || 0) >= 10;
              const effectiveCategory = isStoryWorthy ? 'story_repost' : category;

              const suggestedReply = await generateAISuggestedReply(
                effectiveCategory, tag, post.caption || '',
              );

              await supabase.from('social_opportunities').insert({
                media_id: post.id,
                hashtag: tag,
                permalink: post.permalink,
                caption: (post.caption || '').substring(0, 500),
                likes: post.like_count || 0,
                comments: post.comments_count || 0,
                media_type: post.media_type,
                category: effectiveCategory,
                suggested_reply: isStoryWorthy
                  ? `STORY REPOST CANDIDATE: ${suggestedReply}`
                  : suggestedReply,
                status: 'new',
                posted_at: post.timestamp,
              });

              opportunities++;
            }
          }
        } else {
          console.log(`[OUTREACH] #${tag}: no media returned`);
        }

        hashtagsScanned++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        const errMsg = `#${tag}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[OUTREACH] Exception - ${errMsg}`);
        hashtagErrors.push(errMsg);
      }
    }

    // 3. Check watchlist accounts for new posts
    const { data: watchlistAccounts } = await supabase
      .from('social_watchlist')
      .select('*')
      .eq('type', 'account')
      .eq('active', true);

    if (watchlistAccounts && watchlistAccounts.length > 0) {
      for (const account of watchlistAccounts) {
        try {
          const userSearchRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${INSTAGRAM_ACCOUNT_ID}?fields=business_discovery.fields(username,name,biography,followers_count,media.limit(5){id,caption,media_type,timestamp,permalink,like_count,comments_count}).username(${account.username})&access_token=${META_PAGE_ACCESS_TOKEN}`
          );
          const userData = await userSearchRes.json();

          if (userData.error) {
            const errMsg = `@${account.username}: ${userData.error.message}`;
            console.error(`[OUTREACH] Watchlist error - ${errMsg}`);
            watchlistErrors.push(errMsg);
            continue;
          }

          if (userData.business_discovery?.media?.data) {
            const posts = userData.business_discovery.media.data;
            console.log(`[OUTREACH] @${account.username}: ${posts.length} recent posts`);

            for (const post of posts) {
              const { data: existing } = await supabase
                .from('social_opportunities')
                .select('id')
                .eq('media_id', post.id)
                .maybeSingle();

              if (!existing) {
                const suggestedReply = await generateAISuggestedReply(
                  'watchlist', '', post.caption || '',
                  account.username, account.relationship || 'peer',
                );

                await supabase.from('social_opportunities').insert({
                  media_id: post.id,
                  hashtag: null,
                  permalink: post.permalink,
                  caption: (post.caption || '').substring(0, 500),
                  likes: post.like_count || 0,
                  comments: post.comments_count || 0,
                  media_type: post.media_type,
                  category: 'watchlist',
                  source_username: account.username,
                  suggested_reply: suggestedReply,
                  status: 'new',
                  posted_at: post.timestamp,
                });

                opportunities++;
              }
            }
          } else {
            console.log(`[OUTREACH] @${account.username}: no media data (may not be a business account)`);
            watchlistErrors.push(`@${account.username}: no media returned (requires business/creator account)`);
          }

          watchlistChecked++;
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          const errMsg = `@${account.username}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[OUTREACH] Exception - ${errMsg}`);
          watchlistErrors.push(errMsg);
        }
      }
    }

    // 4. Clean up old opportunities (older than 14 days and still 'new')
    await supabase
      .from('social_opportunities')
      .update({ status: 'expired' })
      .eq('status', 'new')
      .lt('posted_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

    // 5. Summary
    const { count: pendingCount } = await supabase
      .from('social_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    const summary = {
      hashtagsScanned,
      hashtagErrors: hashtagErrors.length,
      watchlistAccountsChecked: watchlistChecked,
      watchlistErrors: watchlistErrors.length,
      newOpportunities: opportunities,
      totalPendingOpportunities: pendingCount || 0,
      timestamp: new Date().toISOString(),
    };

    console.log('[OUTREACH] Scan complete:', JSON.stringify(summary));

    // 6. Email is now handled by the unified marketing-digest cron (runs at 12 PM UTC)
    // This cron just does the scanning work — no more separate email

    return NextResponse.json({ success: true, ...summary, hashtagErrors, watchlistErrors });
  } catch (error) {
    console.error('[OUTREACH] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * Generate AI-powered suggested comment — contextual, empathetic, on-brand
 */
async function generateAISuggestedReply(
  category: string,
  hashtag: string,
  caption: string,
  username?: string,
  relationship?: string,
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return generateFallbackReply(category, caption);

  try {
    const isWatchlist = !!username && !!relationship;
    const context = isWatchlist
      ? `This is from @${username}, a ${relationship} account we follow.`
      : `Found via #${hashtag} hashtag search. Category: ${category}.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You write outreach comments for @thepawcities on Instagram — a platform helping dog owners discover dog-friendly places in 9 cities worldwide (Paris, London, NYC, LA, Barcelona, Geneva, Sydney, Tokyo, Atlanta).

VOICE: Warm, genuine, empathetic, fun-spirited. You're a fellow dog lover, not a brand pitching. Think of how a friendly dog owner would naturally comment on another dog lover's post.

RULES:
- Read the caption carefully. Understand what the post is actually about before commenting.
- Lead with genuine appreciation or empathy for what they shared — never lead with a pitch.
- Be specific about what you liked in their post. Generic "love this!" comments are spam.
- Only mention Paw Cities naturally if it's genuinely relevant (e.g., the post is about finding dog-friendly spots). Never force it.
- If the post is emotional (rescue story, loss, adoption), lead with empathy. NO self-promotion.
- If it's a business showing their dog-friendly space, compliment something specific about their setup.
- Keep it under 150 characters for casual posts, up to 250 for substantive ones.
- Use 1-2 emojis max, naturally placed.
- NEVER use phrases like "check out our site", "have you seen pawcities.com", or anything that reads as an ad.
- Sound like a real person, not a marketing team.

${context}

Return ONLY the comment text. No quotes, no explanation.`,
          },
          {
            role: 'user',
            content: `Post caption: "${caption.substring(0, 400)}"`,
          },
        ],
        temperature: 0.85,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply || reply.length < 5) return generateFallbackReply(category, caption);

    return reply.replace(/^["']|["']$/g, '').trim();
  } catch (err) {
    console.error('[OUTREACH] AI reply generation failed:', err);
    return generateFallbackReply(category, caption);
  }
}

/** Simple fallback if AI is unavailable */
function generateFallbackReply(category: string, caption: string): string {
  const replies: Record<string, string[]> = {
    food: ['This looks like such a great spot for dog owners! 🐾', 'Dog-friendly dining at its finest!'],
    outdoors: ['What a beautiful spot to explore with your pup! 🌿', 'This is paradise for dogs!'],
    travel: ['Dog-friendly travel goals! 🌍🐾', 'This is why traveling with dogs is the best!'],
    rescue: ['This warms our hearts. Thank you for what you do! 🧡', 'The rescue community is incredible. Keep it up!'],
    general: ['Love this! The dog community is the best 🐶', 'Great content for dog lovers!'],
  };
  const options = replies[category] || replies.general;
  return options[caption.length % options.length];
}

// Legacy wrapper for non-watchlist calls
function generateSuggestedReply(category: string, hashtag: string, caption: string): string {
  // Return a placeholder — the async version will be called where possible
  return generateFallbackReply(category, caption);
}

function generateWatchlistReply(username: string, relationship: string, caption: string): string {
  return generateFallbackReply('general', caption);
}
