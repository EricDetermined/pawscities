import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@supabase/supabase-js';
import { publishImagePost } from '@/lib/instagram';
import { CONTENT_BANK, CITY_META, generateCaption } from '@/lib/social-content';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ────────────────── GET ────────────────── */
export async function GET(request: NextRequest) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const db = getSupabaseAdmin();

  /* --- Engagement opportunities from hashtag scanning --- */
  if (type === 'opportunities') {
    const { data } = await db
      .from('social_opportunities')
      .select('*')
      .eq('status', 'new')
      .order('likes', { ascending: false })
      .limit(50);
    return NextResponse.json({ opportunities: data || [] });
  }

  /* --- Unreplied comments on our posts --- */
  if (type === 'comments') {
    const { data } = await db
      .from('social_comments')
      .select('*')
      .eq('replied', false)
      .order('commented_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ comments: data || [] });
  }

  /* --- Event-based post drafts --- */
  if (type === 'event-drafts') {
    // Fetch upcoming approved events
    const { data: events } = await db
      .from('events')
      .select('*, cities!inner(name, slug)')
      .eq('status', 'APPROVED')
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(20);

    // Fetch already-posted event names to avoid duplicates
    const { data: postedPosts } = await db
      .from('social_posts')
      .select('headline')
      .eq('status', 'published');
    const postedSet = new Set((postedPosts || []).map((p: { headline: string }) => p.headline));

    const drafts = (events || []).map((event: Record<string, unknown>) => {
      const cityName = (event.cities as Record<string, string>)?.name || 'Unknown';
      const citySlug = (event.cities as Record<string, string>)?.slug || '';
      const alreadyPosted = postedSet.has(event.name as string);

      // Generate caption for this event
      const startDate = new Date(event.start_date as string);
      const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const endDate = event.end_date ? new Date(event.end_date as string) : null;
      const dateRange = endDate
        ? `${dateStr} - ${endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
        : dateStr;

      const tags = (event.tags as string[]) || [];
      const tagStr = tags.map((t: string) => `#${t.replace(/[- ]/g, '')}`).join(' ');

      const caption = `📅 ${event.name} in ${cityName}!\n\n` +
        `🗓 ${dateRange}\n` +
        (event.venue_name ? `📍 ${event.venue_name}${event.venue_address ? `, ${event.venue_address}` : ''}\n` : '') +
        (event.description ? `\n${(event.description as string).slice(0, 200)}\n` : '') +
        (event.is_free ? '\n🆓 Free event!\n' : '') +
        `\nFind more dog-friendly events at pawcities.com/events\n` +
        (event.source_handle ? `\n📸 h/t ${event.source_handle}\n` : '') +
        `\n#PawCities #DogFriendlyEvents #DogEvents #DogsOfInstagram #${cityName.replace(/\s/g, '')} ${tagStr}`;

      // Generate witty reply suggestions for the source post
      const handle = event.source_handle as string | null;
      const engagementReplies = handle ? [
        `This is awesome! 🐾 We just added ${event.name} to our community events calendar at pawcities.com — dog owners across ${cityName} can now find it and share it. If you ever want to post future events for free, we'd love to feature them!`,
        `Love this! We run a free dog-friendly events calendar at pawcities.com and just listed ${event.name}. The community is going to love it. Hit us up anytime to post new events — always free 🙌`,
        `We're here for this! 🐕 Just featured ${event.name} on our events calendar at pawcities.com so more dog owners can discover it. We just launched our calendar — you can submit future events for free anytime!`,
      ] : [];

      // Build creative URL using the event-creative generator
      const creativeParams = new URLSearchParams({
        name: event.name as string,
        city: cityName,
        citySlug,
        date: dateRange,
        ...(event.venue_name ? { venue: event.venue_name as string } : {}),
        ...(tags.length > 0 ? { tags: tags.join(',') } : {}),
        ...(event.is_free ? { free: 'true' } : {}),
      });
      const creativeUrl = `/api/social/event-creative?${creativeParams.toString()}`;

      return {
        id: event.id,
        type: 'event',
        name: event.name,
        cityName,
        citySlug,
        venueName: event.venue_name,
        venueAddress: event.venue_address,
        startDate: event.start_date,
        endDate: event.end_date,
        tags,
        sourceHandle: event.source_handle,
        sourcePostUrl: event.source_post_url,
        isFeatured: event.is_featured,
        isFree: event.is_free,
        description: event.description,
        caption,
        imageUrl: event.image_url || null,
        creativeUrl,
        engagementReplies,
        alreadyPosted,
      };
    });

    return NextResponse.json({ drafts });
  }

  /* --- Content bank drafts (fact-based posts) --- */
  if (type === 'content-drafts') {
    const { data: postedPosts } = await db
      .from('social_posts')
      .select('headline')
      .eq('status', 'published');
    const postedSet = new Set((postedPosts || []).map((p: { headline: string }) => p.headline));

    const drafts = CONTENT_BANK.map((fact, idx) => {
      const cityMeta = CITY_META[fact.city];
      return {
        id: `content-${idx}`,
        type: 'content',
        headline: fact.headline,
        city: fact.city,
        cityName: cityMeta?.name || fact.city,
        caption: generateCaption(fact),
        alreadyPosted: postedSet.has(fact.headline),
        icon: fact.icon,
        factType: fact.type,
      };
    });

    return NextResponse.json({ drafts });
  }

  /* --- Outreach: suggested comments for event source handles --- */
  if (type === 'outreach') {
    const { data: events } = await db
      .from('events')
      .select('id, name, venue_name, city_id, source_handle, source_post_url, start_date, tags, cities!inner(name)')
      .eq('status', 'APPROVED')
      .not('source_handle', 'is', null)
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true });

    const outreach = (events || []).map((event: Record<string, unknown>) => {
      const cityName = (event.cities as Record<string, string>)?.name || '';
      const handle = event.source_handle as string;

      const templates = [
        `Love this! We just featured ${event.name} on pawcities.com — the go-to guide for dog-friendly places & events in ${cityName} and 7 other cities worldwide 🐾`,
        `This event looks amazing! 🐾 We added it to our dog-friendly events calendar at pawcities.com so more dog owners can discover it!`,
        `So cool! We curate the best dog-friendly events worldwide and ${event.name} is on our list. Check it out at pawcities.com/events 🌍🐕`,
      ];

      return {
        id: event.id,
        eventName: event.name,
        handle,
        sourcePostUrl: event.source_post_url,
        cityName,
        startDate: event.start_date,
        suggestedComments: templates,
        type: 'comment',
      };
    });

    return NextResponse.json({ outreach });
  }

  /* --- Business invitations: DM templates for venues hosting events --- */
  if (type === 'invitations') {
    const { data: events } = await db
      .from('events')
      .select('id, name, venue_name, venue_address, city_id, source_handle, start_date, cities!inner(name)')
      .eq('status', 'APPROVED')
      .not('venue_name', 'is', null)
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true });

    const invitations = (events || []).map((event: Record<string, unknown>) => {
      const cityName = (event.cities as Record<string, string>)?.name || '';
      const venue = event.venue_name as string;

      const dmTemplate = `Hi ${venue}! 👋\n\n` +
        `We noticed you're hosting "${event.name}" — that's awesome! ` +
        `We run Paw Cities (pawcities.com), a free directory of dog-friendly places across ${cityName} and 7 other cities worldwide.\n\n` +
        `We'd love to list ${venue} on our site so more dog owners can discover you. ` +
        `It's completely free — you can claim your listing at pawcities.com and add your details, photos, and upcoming events.\n\n` +
        `Let us know if you have any questions! 🐾`;

      return {
        id: event.id,
        eventName: event.name,
        venueName: venue,
        venueAddress: event.venue_address,
        cityName,
        sourceHandle: event.source_handle,
        startDate: event.start_date,
        dmTemplate,
        type: 'dm',
      };
    });

    return NextResponse.json({ invitations });
  }

  /* --- Performance: recent post stats --- */
  if (type === 'performance') {
    const { data: posts } = await db
      .from('social_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const published = (posts || []).filter((p: Record<string, unknown>) => p.status === 'published');
    const failed = (posts || []).filter((p: Record<string, unknown>) => p.status === 'failed');
    const totalLikes = published.reduce((sum: number, p: Record<string, unknown>) => sum + ((p.likes as number) || 0), 0);
    const totalComments = published.reduce((sum: number, p: Record<string, unknown>) => sum + ((p.comments_count as number) || 0), 0);

    return NextResponse.json({
      posts: posts || [],
      stats: {
        totalPublished: published.length,
        totalFailed: failed.length,
        avgLikes: published.length ? Math.round(totalLikes / published.length) : 0,
        avgComments: published.length ? Math.round(totalComments / published.length) : 0,
        contentRemaining: CONTENT_BANK.length - published.length,
      },
    });
  }

  /* --- Summary: counts for all sections --- */
  if (type === 'summary') {
    const [opps, comments, events] = await Promise.all([
      db.from('social_opportunities').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      db.from('social_comments').select('id', { count: 'exact', head: true }).eq('replied', false),
      db.from('events').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('start_date', new Date().toISOString().split('T')[0]),
    ]);

    return NextResponse.json({
      opportunities: opps.count || 0,
      unrepliedComments: comments.count || 0,
      upcomingEvents: events.count || 0,
    });
  }

  return NextResponse.json({ error: 'Invalid type parameter. Use: opportunities, comments, event-drafts, content-drafts, outreach, invitations, performance, summary' }, { status: 400 });
}

/* ────────────────── PATCH ────────────────── */
export async function PATCH(request: NextRequest) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { id, type, status, replied } = await request.json();

  if (type === 'opportunity' && id && status) {
    await db
      .from('social_opportunities')
      .update({ status, engaged_at: status === 'engaged' ? new Date().toISOString() : null })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (type === 'comment' && id && replied !== undefined) {
    await db
      .from('social_comments')
      .update({ replied, replied_at: replied ? new Date().toISOString() : null })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

/* ────────────────── POST (Publish) ────────────────── */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const db = getSupabaseAdmin();
  const body = await request.json();
  const { action } = body;

  /* --- Publish a post to Instagram --- */
  if (action === 'publish') {
    const { caption, imageUrl, headline, city, eventId } = body;

    if (!caption) {
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }

    // Use provided imageUrl or fallback to hero dogs
    const finalImageUrl = imageUrl || 'https://pawcities.com/images/hero-dogs.jpg';

    // Publish to Instagram
    const result = await publishImagePost(finalImageUrl, caption);

    // Get permalink if published
    let permalink = null;
    if (result.success && result.postId) {
      try {
        const token = process.env.META_PAGE_ACCESS_TOKEN;
        const version = process.env.META_API_VERSION || 'v25.0';
        const res = await fetch(
          `https://graph.facebook.com/${version}/${result.postId}?fields=permalink&access_token=${token}`
        );
        const data = await res.json();
        permalink = data.permalink || null;
      } catch {
        // Non-critical
      }
    }

    // Log to social_posts
    await db.from('social_posts').insert({
      platform: 'instagram',
      post_id: result.postId || null,
      container_id: result.containerId || null,
      headline: headline || caption.slice(0, 60),
      city: city || null,
      caption,
      image_url: finalImageUrl,
      status: result.success ? 'published' : 'failed',
      error_message: result.error || null,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      permalink,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
