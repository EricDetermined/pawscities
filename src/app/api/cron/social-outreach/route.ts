import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSocialDigest } from '@/lib/email';

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

export const maxDuration = 120; // 2 minutes

// Niche hashtags to monitor — dog-friendly places, pet travel, dog owners
const DEFAULT_HASHTAGS = [
  'dogfriendly',
  'dogfriendlyrestaurant',
  'dogfriendlycafe',
  'dogfriendlyhotel',
  'dogsofinstagram',
  'dogtravel',
  'travelwithdog',
  'petfriendly',
  'dogfriendlylondon',
  'dogfriendlyparis',
  'doglovers',
  'doglife',
  'dogmom',
  'dogdad',
  'pawcities',
];

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
 * 1. Search niche hashtags for trending posts
 * 2. Surface engagement opportunities (high-engagement posts we should interact with)
 * 3. Track accounts on our watchlist for new content
 * 4. Draft suggested engagement responses for admin review
 * 5. Identify potential partnership/feature opportunities
 *
 * Uses Instagram Graph API hashtag search (available for business accounts)
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
  let opportunities = 0;
  let hashtagsScanned = 0;
  let watchlistChecked = 0;

  try {
    // 1. Load hashtags to monitor (from DB or defaults)
    let hashtags = DEFAULT_HASHTAGS;
    const { data: customHashtags } = await supabase
      .from('social_watchlist')
      .select('hashtag')
      .eq('type', 'hashtag')
      .eq('active', true);

    if (customHashtags && customHashtags.length > 0) {
      hashtags = [
        ...customHashtags.map((h: { hashtag: string }) => h.hashtag),
        ...DEFAULT_HASHTAGS,
      ];
      // Deduplicate
      hashtags = [...new Set(hashtags)];
    }

    // 2. Search hashtags for recent top posts
    // Instagram requires a hashtag ID first, then search recent/top media
    for (const tag of hashtags.slice(0, 10)) { // Limit to 10 per run to stay within API limits
      try {
        // Get hashtag ID
        const hashtagSearchRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/ig_hashtag_search?q=${encodeURIComponent(tag)}&user_id=${INSTAGRAM_ACCOUNT_ID}&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const hashtagSearchData = await hashtagSearchRes.json();

        if (hashtagSearchData.error || !hashtagSearchData.data?.[0]?.id) {
          console.log(`Hashtag search failed for #${tag}: ${hashtagSearchData.error?.message || 'no results'}`);
          continue;
        }

        const hashtagId = hashtagSearchData.data[0].id;

        // Get top media for this hashtag
        const mediaRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${hashtagId}/top_media?user_id=${INSTAGRAM_ACCOUNT_ID}&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&access_token=${META_PAGE_ACCESS_TOKEN}`
        );
        const mediaData = await mediaRes.json();

        if (mediaData.data && mediaData.data.length > 0) {
          // Filter for high-engagement posts (potential engagement opportunities)
          const topPosts: HashtagMedia[] = mediaData.data
            .filter((post: HashtagMedia) => {
              const likes = post.like_count || 0;
              const comments = post.comments_count || 0;
              // Only surface posts with meaningful engagement
              return likes >= 50 || comments >= 5;
            })
            .slice(0, 5); // Top 5 per hashtag

          for (const post of topPosts) {
            // Check if we've already tracked this opportunity
            const { data: existing } = await supabase
              .from('social_opportunities')
              .select('id')
              .eq('media_id', post.id)
              .single();

            if (!existing) {
              // Classify the opportunity
              const caption = (post.caption || '').toLowerCase();
              let category = 'general';
              if (caption.includes('restaurant') || caption.includes('cafe') || caption.includes('brunch')) category = 'food';
              else if (caption.includes('park') || caption.includes('hike') || caption.includes('trail')) category = 'outdoors';
              else if (caption.includes('hotel') || caption.includes('travel') || caption.includes('vacation')) category = 'travel';
              else if (caption.includes('rescue') || caption.includes('adopt') || caption.includes('shelter')) category = 'rescue';

              // Draft a suggested engagement response
              const suggestedReply = generateSuggestedReply(category, tag, post.caption || '');

              await supabase.from('social_opportunities').insert({
                media_id: post.id,
                hashtag: tag,
                permalink: post.permalink,
                caption: (post.caption || '').substring(0, 500),
                likes: post.like_count || 0,
                comments: post.comments_count || 0,
                media_type: post.media_type,
                category,
                suggested_reply: suggestedReply,
                status: 'new',
                posted_at: post.timestamp,
              });

              opportunities++;
            }
          }
        }

        hashtagsScanned++;
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error scanning hashtag #${tag}:`, err);
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
          // Instagram Graph API can search for business/creator accounts by username
          const userSearchRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${INSTAGRAM_ACCOUNT_ID}?fields=business_discovery.fields(username,name,biography,followers_count,media.limit(5){id,caption,media_type,timestamp,permalink,like_count,comments_count}).username(${account.username})&access_token=${META_PAGE_ACCESS_TOKEN}`
          );
          const userData = await userSearchRes.json();

          if (userData.business_discovery?.media?.data) {
            for (const post of userData.business_discovery.media.data) {
              // Check if already tracked
              const { data: existing } = await supabase
                .from('social_opportunities')
                .select('id')
                .eq('media_id', post.id)
                .single();

              if (!existing) {
                const suggestedReply = generateWatchlistReply(
                  account.username,
                  account.relationship || 'peer',
                  post.caption || ''
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
          }

          watchlistChecked++;
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`Error checking watchlist account @${account.username}:`, err);
        }
      }
    }

    // 4. Clean up old opportunities (older than 7 days and still 'new')
    await supabase
      .from('social_opportunities')
      .update({ status: 'expired' })
      .eq('status', 'new')
      .lt('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // 5. Summary
    const { count: pendingCount } = await supabase
      .from('social_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');

    const summary = {
      hashtagsScanned,
      watchlistAccountsChecked: watchlistChecked,
      newOpportunities: opportunities,
      totalPendingOpportunities: pendingCount || 0,
      timestamp: new Date().toISOString(),
    };

    console.log('Social outreach scan complete:', summary);

    // 6. Send daily social digest email
    try {
      // Get new opportunities for the email
      const { data: newOpps } = await supabase
        .from('social_opportunities')
        .select('permalink, caption, category, suggested_reply, likes')
        .eq('status', 'new')
        .order('likes', { ascending: false })
        .limit(5);

      // Get unreplied comments
      const { data: unreplied } = await supabase
        .from('social_comments')
        .select('username, text, post_id')
        .eq('replied', false)
        .order('commented_at', { ascending: false })
        .limit(5);

      // Get top performing post from social_posts
      const { data: topPosts } = await supabase
        .from('social_posts')
        .select('post_id, likes, comments_count, caption')
        .eq('status', 'published')
        .order('engagement_score', { ascending: false })
        .limit(1);

      // Get engagement averages
      const { data: allPosts } = await supabase
        .from('social_posts')
        .select('likes, comments_count')
        .eq('status', 'published');

      const avgLikes = allPosts && allPosts.length > 0
        ? Math.round(allPosts.reduce((s: number, p: { likes: number }) => s + (p.likes || 0), 0) / allPosts.length)
        : 0;
      const avgComments = allPosts && allPosts.length > 0
        ? Math.round((allPosts.reduce((s: number, p: { comments_count: number }) => s + (p.comments_count || 0), 0) / allPosts.length) * 10) / 10
        : 0;

      const topPost = topPosts?.[0] ? {
        permalink: `https://instagram.com/p/${topPosts[0].post_id}`,
        likes: topPosts[0].likes || 0,
        comments: topPosts[0].comments_count || 0,
        caption: topPosts[0].caption || '',
      } : null;

      await sendSocialDigest({
        newOpportunities: (newOpps || []).map((o: { permalink: string; caption: string; category: string; suggested_reply: string; likes: number }) => ({
          permalink: o.permalink,
          caption: o.caption || '',
          category: o.category || 'general',
          suggestedReply: o.suggested_reply || '',
          likes: o.likes || 0,
        })),
        unrepliedComments: (unreplied || []).map((c: { username: string; text: string; post_id: string }) => ({
          username: c.username,
          text: c.text,
          postId: c.post_id,
        })),
        topPost,
        totalPendingOpportunities: pendingCount || 0,
        engagementSummary: {
          avgLikes,
          avgComments,
          postsTracked: allPosts?.length || 0,
        },
      });
      console.log('Social digest email sent');
    } catch (emailErr) {
      console.error('Failed to send social digest email:', emailErr);
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('Social outreach error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * Generate a suggested comment reply based on the content category
 */
function generateSuggestedReply(category: string, hashtag: string, caption: string): string {
  const replies: Record<string, string[]> = {
    food: [
      'This looks amazing for dog owners! Is this spot listed on pawcities.com yet? We\'d love to feature it!',
      'Our community would love to know about this place! Mind if we share it on Paw Cities?',
      'Dog-friendly dining at its finest! Have you checked out other spots like this on pawcities.com?',
    ],
    outdoors: [
      'What a beautiful spot for dogs! We feature places like this on pawcities.com for dog owners to discover.',
      'This is exactly the kind of spot our Paw Cities community loves. Off-leash heaven!',
      'Perfect for an adventure with your pup! We\'re mapping spots like this across 8 cities at pawcities.com',
    ],
    travel: [
      'Traveling with dogs is the best! We\'re building the ultimate guide for dog-friendly travel at pawcities.com',
      'This is why we built Paw Cities - helping dog owners find places like this around the world!',
      'Dog-friendly travel goals! Check out pawcities.com for more spots in this city.',
    ],
    rescue: [
      'Thank you for sharing this! The dog community is the best. We love highlighting rescue-friendly spots on pawcities.com',
      'This warms our hearts! The Paw Cities community supports rescue organizations. Keep up the amazing work!',
    ],
    general: [
      'Love this! Dog owners need more content like this. Have you seen pawcities.com?',
      'This is what the dog community is all about! We\'re building something similar at Paw Cities.',
      'Great content for dog lovers! We\'d love to connect and share resources for the community.',
    ],
  };

  const options = replies[category] || replies.general;
  // Use caption length as a simple seed for variety
  const index = caption.length % options.length;
  return options[index];
}

/**
 * Generate a more personalized reply for watchlist accounts
 */
function generateWatchlistReply(username: string, relationship: string, caption: string): string {
  if (relationship === 'partner') {
    return `Love this from @${username}! Our Paw Cities community would benefit from this. Mind if we share?`;
  }
  if (relationship === 'influencer') {
    return `Amazing content as always @${username}! We\'d love to collaborate and feature this on Paw Cities.`;
  }
  if (relationship === 'business') {
    return `Great to see this @${username}! Are you listed on pawcities.com yet? Free listing for dog-friendly businesses!`;
  }
  return `Love what you\'re sharing @${username}! The dog-friendly community needs more of this.`;
}
