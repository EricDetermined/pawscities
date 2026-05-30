export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getMetaToken() { return process.env.META_PAGE_ACCESS_TOKEN; }
function getMetaApiVersion() { return process.env.META_API_VERSION || 'v21.0'; }

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const BRAND_CONTEXT = `You are the social media voice for @thepawcities — a platform helping dog owners discover dog-friendly places in cities worldwide (Paris, London, NYC, LA, Barcelona, Geneva, Sydney, Tokyo).

VOICE: Warm, genuine, community-focused. Like talking to a fellow dog lover. Never corporate.

REPLY RULES:
- Read the comment carefully. Understand the FULL intent, emotion, and subtext.
- Match the energy — short comments get short replies, thoughtful ones get thoughtful replies.
- Use 1-2 emojis naturally. Never overdo it.
- NEVER sound like a bot. No generic "Thanks for engaging!" language.
- Each reply must feel like it was written by a human who actually read the comment.

Return ONLY the reply text. No quotes, no explanation.`;

/**
 * POST /api/admin/social/reply
 *
 * Manually trigger an AI-powered reply to a specific comment.
 * Bypasses the 48-hour age limit used by the cron.
 *
 * Body: { commentId: string } — the comment_id from social_comments table
 *   OR: { replyAll: "share_request" } — reply to all unreplied share_request comments
 */
export async function POST(request: NextRequest) {
  const META_PAGE_ACCESS_TOKEN = getMetaToken();
  const META_API_VERSION = getMetaApiVersion();

  if (!META_PAGE_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Instagram API credentials not configured' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const body = await request.json();

  // Mode 1: Reply to all unreplied share_request comments
  if (body.replyAll === 'share_request') {
    const { data: pendingComments, error } = await supabase
      .from('social_comments')
      .select('*')
      .eq('replied', false)
      .eq('sentiment', 'share_request')
      .order('commented_at', { ascending: true });

    if (error || !pendingComments || pendingComments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unreplied share_request comments found',
        replied: 0,
      });
    }

    const results: { username: string; success: boolean; reply?: string; error?: string }[] = [];

    for (const comment of pendingComments) {
      // Look up permalink from Instagram API and caption from our DB
      const { data: postData } = await supabase
        .from('social_posts')
        .select('caption')
        .eq('post_id', comment.post_id)
        .maybeSingle();

      const caption = postData?.caption || '';
      const permalink = await fetchPermalink(comment.post_id, META_API_VERSION, META_PAGE_ACCESS_TOKEN);

      // Generate AI reply with share context
      const replyText = await generateShareReply(
        comment.text,
        comment.username,
        caption,
        permalink,
      );

      if (!replyText) {
        results.push({ username: comment.username, success: false, error: 'AI returned SKIP' });
        continue;
      }

      // Post the reply via Graph API
      const replyResult = await postReply(comment.comment_id, replyText, META_API_VERSION, META_PAGE_ACCESS_TOKEN);

      if (replyResult.success) {
        await supabase
          .from('social_comments')
          .update({
            replied: true,
            reply_text: replyText,
            replied_at: new Date().toISOString(),
          })
          .eq('comment_id', comment.comment_id);

        results.push({ username: comment.username, success: true, reply: replyText });
      } else {
        results.push({ username: comment.username, success: false, error: replyResult.error });
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      replied: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  }

  // Mode 2: Reply to a single comment by ID
  if (!body.commentId) {
    return NextResponse.json({ error: 'commentId or replyAll required' }, { status: 400 });
  }

  const { data: comment, error: commentError } = await supabase
    .from('social_comments')
    .select('*')
    .eq('comment_id', body.commentId)
    .maybeSingle();

  if (commentError || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Look up caption from our DB, permalink from Instagram API
  const { data: postData } = await supabase
    .from('social_posts')
    .select('caption')
    .eq('post_id', comment.post_id)
    .maybeSingle();

  const caption = postData?.caption || '';
  const permalink = await fetchPermalink(comment.post_id, META_API_VERSION, META_PAGE_ACCESS_TOKEN);
  const sentiment = comment.sentiment || 'neutral';

  // Generate reply
  const replyText = sentiment === 'share_request'
    ? await generateShareReply(comment.text, comment.username, caption, permalink)
    : await generateGenericReply(comment.text, comment.username, caption, sentiment);

  if (!replyText) {
    return NextResponse.json({ error: 'AI decided to skip this comment' }, { status: 200 });
  }

  // Post
  const result = await postReply(comment.comment_id, replyText, META_API_VERSION, META_PAGE_ACCESS_TOKEN);

  if (result.success) {
    await supabase
      .from('social_comments')
      .update({
        replied: true,
        reply_text: replyText,
        replied_at: new Date().toISOString(),
      })
      .eq('comment_id', comment.comment_id);
  }

  return NextResponse.json({
    success: result.success,
    reply: replyText,
    error: result.error,
  });
}

async function fetchPermalink(
  mediaId: string,
  apiVersion: string,
  accessToken: string,
): Promise<string> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${mediaId}?fields=permalink&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    return data.permalink || '';
  } catch {
    return '';
  }
}

async function generateShareReply(
  commentText: string,
  username: string,
  postCaption: string,
  permalink: string,
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return fallbackShareReply(permalink);

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
            content: `POST CAPTION: "${postCaption.substring(0, 300)}"

COMMENT by @${username}: "${commentText}"

This account is asking to share/repost our content. Reply warmly granting permission. Ask them to credit @thepawcities so our community can find them. Include the post link: ${permalink}

Keep it friendly, appreciative, and natural — like a fellow dog lover would respond. Under 200 characters ideally.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply || reply === 'SKIP') return fallbackShareReply(permalink);
    return reply.replace(/^["']|["']$/g, '').trim();
  } catch {
    return fallbackShareReply(permalink);
  }
}

function fallbackShareReply(permalink: string): string {
  const replies = [
    `Of course! We'd love that 🐾 Just tag @thepawcities so our community can find you too! ${permalink}`,
    `Go for it! 🙌 Credit @thepawcities and spread the dog-friendly love! ${permalink}`,
    `Absolutely! Tag us @thepawcities when you share 🐶 Here you go: ${permalink}`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

async function generateGenericReply(
  commentText: string,
  username: string,
  postCaption: string,
  sentiment: string,
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

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
            content: `POST CAPTION: "${postCaption.substring(0, 300)}"

COMMENT by @${username}: "${commentText}"

DETECTED SENTIMENT: ${sentiment}

Write a reply. If it should not be replied to, return exactly "SKIP".`,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply || reply.toUpperCase() === 'SKIP') return null;
    return reply.replace(/^["']|["']$/g, '').trim();
  } catch {
    return null;
  }
}

async function postReply(
  commentId: string,
  message: string,
  apiVersion: string,
  accessToken: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: accessToken }),
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
