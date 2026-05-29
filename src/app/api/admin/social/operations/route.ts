import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const maxDuration = 300; // 5 min — scrape + reply can take a while

// ─── GET: Queue stats ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Count unreplied comments
  const { count: unrepliedCount } = await supabase
    .from('social_comments')
    .select('id', { count: 'exact', head: true })
    .eq('replied', false);

  // Count total comments
  const { count: totalCount } = await supabase
    .from('social_comments')
    .select('id', { count: 'exact', head: true });

  // Count by sentiment
  const { data: sentimentData } = await supabase
    .from('social_comments')
    .select('sentiment')
    .eq('replied', false);

  const sentimentCounts: Record<string, number> = {};
  for (const row of sentimentData || []) {
    const s = row.sentiment || 'unknown';
    sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
  }

  // Oldest unreplied comment
  const { data: oldest } = await supabase
    .from('social_comments')
    .select('commented_at')
    .eq('replied', false)
    .order('commented_at', { ascending: true })
    .limit(1);

  const oldestAge = oldest?.[0]?.commented_at
    ? Math.floor((Date.now() - new Date(oldest[0].commented_at).getTime()) / (1000 * 60 * 60))
    : null;

  return NextResponse.json({
    queue: {
      unreplied: unrepliedCount || 0,
      total: totalCount || 0,
      bySentiment: sentimentCounts,
      oldestUnrepliedHoursAgo: oldestAge,
    },
  });
}

// ─── POST: Trigger operations ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, limit: replyLimit } = body;

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results: {
    action: string;
    scrapeResult?: unknown;
    purgeResult?: { purged: number };
    replyResult?: unknown;
  } = { action };

  try {
    // ─── Action: scrape_and_reply ─────────────────────────────────────
    // Full pipeline: purge stale unreplied → scrape fresh comments → auto-reply
    if (action === 'scrape_and_reply') {
      // Step 1: Purge stale unreplied comments (older than 48 hours)
      // These are too old to reply to and would clutter the queue
      const purgeResult = await purgeStaleComments(getSupabaseAdmin());
      results.purgeResult = purgeResult;

      // Step 2: Run the engagement cron (scrapes + auto-replies)
      const scrapeRes = await fetch(`${baseUrl}/api/cron/social-engagement`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(240000), // 4 min timeout
      });
      results.scrapeResult = await scrapeRes.json();

      return NextResponse.json({ success: true, ...results });
    }

    // ─── Action: reply_queue ─────────────────────────────────────────
    // Reply to next N unreplied comments from the existing queue (no scraping)
    if (action === 'reply_queue') {
      const maxReplies = Math.min(replyLimit || 25, 50); // Cap at 50
      const replyResult = await replyToQueue(getSupabaseAdmin(), maxReplies);
      results.replyResult = replyResult;
      return NextResponse.json({ success: true, ...results });
    }

    // ─── Action: purge_stale ─────────────────────────────────────────
    // Just purge stale comments without scraping or replying
    if (action === 'purge_stale') {
      const purgeResult = await purgeStaleComments(getSupabaseAdmin());
      results.purgeResult = purgeResult;
      return NextResponse.json({ success: true, ...results });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[OPERATIONS] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── Purge stale unreplied comments ──────────────────────────────────────────
// Comments older than 48 hours that haven't been replied to are stale.
// Instagram's API won't let us reply to very old comments anyway.

async function purgeStaleComments(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Mark stale unreplied comments as "replied" with a note, so they leave the queue
  const { data, error } = await supabase
    .from('social_comments')
    .update({
      replied: true,
      reply_text: '[STALE — auto-purged, comment too old to reply]',
      replied_at: new Date().toISOString(),
    })
    .eq('replied', false)
    .lt('commented_at', cutoff)
    .select('id');

  if (error) {
    console.error('[OPERATIONS] Purge error:', error.message);
    return { purged: 0, error: error.message };
  }

  const purgedCount = data?.length || 0;
  console.log(`[OPERATIONS] Purged ${purgedCount} stale comments (older than 48h)`);
  return { purged: purgedCount };
}

// ─── Reply to unreplied queue ────────────────────────────────────────────────
// Picks up the next N unreplied comments and auto-replies using GPT + Instagram API

async function replyToQueue(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxReplies: number,
) {
  const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
  const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const OUR_USERNAME = process.env.INSTAGRAM_USERNAME || 'thepawcities';

  if (!META_PAGE_ACCESS_TOKEN) {
    return { error: 'META_PAGE_ACCESS_TOKEN not configured', replied: 0 };
  }
  if (!OPENAI_KEY) {
    return { error: 'OPENAI_API_KEY not configured', replied: 0 };
  }

  // Get unreplied comments, newest first (fresher = more likely to get a response)
  const { data: unreplied, error: fetchError } = await supabase
    .from('social_comments')
    .select('id, comment_id, post_id, username, text, sentiment, commented_at')
    .eq('replied', false)
    .order('commented_at', { ascending: false })
    .limit(maxReplies);

  if (fetchError || !unreplied) {
    return { error: fetchError?.message || 'No comments found', replied: 0 };
  }

  // Skip our own comments and spam
  const candidates = unreplied.filter(c =>
    c.username !== OUR_USERNAME && c.sentiment !== 'spam'
  );

  let replied = 0;
  let skipped = 0;
  let errors = 0;
  const details: { username: string; preview: string; status: string }[] = [];

  // Get post captions for context (batch lookup)
  const postIds = [...new Set(candidates.map(c => c.post_id))];
  const { data: posts } = await supabase
    .from('social_posts')
    .select('post_id, caption, permalink')
    .in('post_id', postIds);
  const postMap = new Map(posts?.map(p => [p.post_id, p]) || []);

  for (const comment of candidates) {
    const post = postMap.get(comment.post_id);

    // Generate AI reply
    const replyText = await generateReply(
      comment.text,
      comment.username,
      post?.caption || '',
      comment.sentiment || 'neutral',
      post?.permalink,
      OPENAI_KEY,
    );

    if (!replyText) {
      skipped++;
      // Mark as replied with skip note so it doesn't come back
      await supabase
        .from('social_comments')
        .update({
          replied: true,
          reply_text: '[SKIPPED by AI — not reply-worthy]',
          replied_at: new Date().toISOString(),
        })
        .eq('id', comment.id);
      details.push({ username: comment.username, preview: comment.text.substring(0, 40), status: 'skipped' });
      continue;
    }

    // Post to Instagram
    try {
      const url = `https://graph.facebook.com/${META_API_VERSION}/${comment.comment_id}/replies`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: replyText,
          access_token: META_PAGE_ACCESS_TOKEN,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();

      if (data.error) {
        errors++;
        details.push({ username: comment.username, preview: comment.text.substring(0, 40), status: `error: ${data.error.message}` });
        // Still mark as replied to avoid retrying errors
        await supabase
          .from('social_comments')
          .update({
            replied: true,
            reply_text: `[ERROR: ${data.error.message}] ${replyText}`,
            replied_at: new Date().toISOString(),
          })
          .eq('id', comment.id);
      } else {
        replied++;
        await supabase
          .from('social_comments')
          .update({
            replied: true,
            reply_text: replyText,
            replied_at: new Date().toISOString(),
          })
          .eq('id', comment.id);
        details.push({ username: comment.username, preview: replyText.substring(0, 40), status: 'replied' });
      }
    } catch (err) {
      errors++;
      details.push({ username: comment.username, preview: comment.text.substring(0, 40), status: `error: ${String(err)}` });
    }

    // Rate limit: 500ms between replies
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    total: candidates.length,
    replied,
    skipped,
    errors,
    details: details.slice(0, 10), // First 10 for preview
  };
}

// ─── AI Reply Generation (standalone version for queue processing) ───────────

const BRAND_CONTEXT = `You are the social media voice for @thepawcities — a platform helping dog owners discover dog-friendly places in cities worldwide (Paris, London, NYC, LA, Barcelona, Geneva, Sydney, Tokyo).

BRAND MASCOTS: Buster & Marley are animated characters inspired by the founder's real dogs.
- Buster: a golden-tan mixed breed, the adventurer — enthusiastic, playful
- Marley: a golden-apricot goldendoodle, the brains — calm, clever, witty

VOICE: Warm, genuine, community-focused. Not corporate. Like talking to a fellow dog lover.

REPLY RULES:
- Read the comment carefully. Understand the FULL intent, emotion, and subtext — not just keywords.
- Match the energy of the comment. Short casual comments get short replies. Thoughtful comments get thoughtful replies.
- If someone is skeptical or critical, NEVER be defensive. Acknowledge their point, then gently reframe positively.
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

async function generateReply(
  commentText: string,
  commentUsername: string,
  postCaption: string,
  sentiment: string,
  postPermalink?: string,
  openaiKey?: string,
): Promise<string | null> {
  if (!openaiKey) return null;

  const shareContext = sentiment === 'share_request' && postPermalink
    ? `\n\nSHARE REQUEST DETECTED: Reply warmly granting permission, ask them to credit @thepawcities, and include the post link: ${postPermalink}`
    : '';

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

DETECTED SENTIMENT: ${sentiment}${shareContext}

Write a reply to this comment. If it should not be replied to, return exactly "SKIP".`,
          },
        ],
        temperature: 0.8,
        max_tokens: 250,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply || reply === 'SKIP' || reply.toUpperCase() === 'SKIP') return null;
    const cleaned = reply.replace(/^["']|["']$/g, '').trim();
    if (cleaned.length < 2 || cleaned.length > 500) return null;
    return cleaned;
  } catch {
    return null;
  }
}
