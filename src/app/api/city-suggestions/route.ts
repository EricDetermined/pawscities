import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// GET: Fetch leaderboard of city suggestions (public)
export async function GET() {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get user's votes if logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all active suggestions ordered by votes
  const { data: suggestions, error } = await supabaseAdmin
    .from('city_suggestions')
    .select('id, city_name, country, state_region, vote_count, status, created_at')
    .eq('status', 'active')
    .order('vote_count', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching city suggestions:', error);
    return NextResponse.json({ suggestions: [], userVotes: [] });
  }

  // Fetch user's votes if authenticated
  let userVotes: string[] = [];
  if (user) {
    const { data: votes } = await supabaseAdmin
      .from('city_suggestion_votes')
      .select('suggestion_id')
      .eq('user_id', user.id);
    userVotes = (votes || []).map(v => v.suggestion_id);
  }

  return NextResponse.json({ suggestions: suggestions || [], userVotes });
}

// POST: Suggest a new city or vote for existing one
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Please log in to suggest or vote for a city.' }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const body = await request.json();
  const { action } = body;

  // === VOTE for an existing suggestion ===
  if (action === 'vote') {
    const { suggestionId } = body;
    if (!suggestionId) {
      return NextResponse.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    // Check if already voted
    const { data: existingVote } = await supabaseAdmin
      .from('city_suggestion_votes')
      .select('id')
      .eq('suggestion_id', suggestionId)
      .eq('user_id', user.id)
      .single();

    if (existingVote) {
      return NextResponse.json({ error: 'You already voted for this city.' }, { status: 409 });
    }

    // Insert vote
    const { error: voteError } = await supabaseAdmin
      .from('city_suggestion_votes')
      .insert({ suggestion_id: suggestionId, user_id: user.id });

    if (voteError) {
      console.error('Vote error:', voteError);
      return NextResponse.json({ error: 'Failed to vote.' }, { status: 500 });
    }

    // Increment vote count
    const { data: suggestion } = await supabaseAdmin
      .from('city_suggestions')
      .select('vote_count')
      .eq('id', suggestionId)
      .single();

    await supabaseAdmin
      .from('city_suggestions')
      .update({ vote_count: (suggestion?.vote_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', suggestionId);

    return NextResponse.json({ success: true, message: 'Vote recorded!' });
  }

  // === UNVOTE ===
  if (action === 'unvote') {
    const { suggestionId } = body;
    if (!suggestionId) {
      return NextResponse.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('city_suggestion_votes')
      .delete()
      .eq('suggestion_id', suggestionId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove vote.' }, { status: 500 });
    }

    // Decrement vote count
    const { data: suggestion } = await supabaseAdmin
      .from('city_suggestions')
      .select('vote_count')
      .eq('id', suggestionId)
      .single();

    await supabaseAdmin
      .from('city_suggestions')
      .update({ vote_count: Math.max(0, (suggestion?.vote_count || 1) - 1), updated_at: new Date().toISOString() })
      .eq('id', suggestionId);

    return NextResponse.json({ success: true, message: 'Vote removed.' });
  }

  // === SUGGEST a new city ===
  if (action === 'suggest') {
    const { cityName, country, stateRegion } = body;

    if (!cityName || typeof cityName !== 'string' || cityName.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter a valid city name (at least 2 characters).' }, { status: 400 });
    }
    if (!country || typeof country !== 'string' || country.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter a country.' }, { status: 400 });
    }

    const cleanCity = cityName.trim();
    const cleanCountry = country.trim();
    const cleanState = (stateRegion || '').trim();

    // Check for duplicates (case-insensitive)
    const { data: existing } = await supabaseAdmin
      .from('city_suggestions')
      .select('id, city_name, country, vote_count')
      .ilike('city_name', cleanCity)
      .ilike('country', cleanCountry)
      .eq('status', 'active');

    // If a matching suggestion exists with same state/region, auto-vote instead
    if (existing && existing.length > 0) {
      const match = existing[0];

      // Check if user already voted
      const { data: existingVote } = await supabaseAdmin
        .from('city_suggestion_votes')
        .select('id')
        .eq('suggestion_id', match.id)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        return NextResponse.json({
          error: `"${match.city_name}" has already been suggested and you've already voted for it!`,
          existingSuggestion: match,
        }, { status: 409 });
      }

      // Auto-vote for the existing suggestion
      await supabaseAdmin
        .from('city_suggestion_votes')
        .insert({ suggestion_id: match.id, user_id: user.id });

      await supabaseAdmin
        .from('city_suggestions')
        .update({ vote_count: match.vote_count + 1, updated_at: new Date().toISOString() })
        .eq('id', match.id);

      return NextResponse.json({
        success: true,
        message: `"${match.city_name}" was already suggested — your vote has been added!`,
        suggestion: { ...match, vote_count: match.vote_count + 1 },
        autoVoted: true,
      });
    }

    // Honeypot check: if the hidden field "website" is filled, it's a bot
    if (body.website) {
      // Silently accept but don't save
      return NextResponse.json({ success: true, message: 'Thanks for your suggestion!' });
    }

    // Rate limit: max 5 suggestions per user per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('city_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .gte('created_at', oneDayAgo);

    if ((count || 0) >= 5) {
      return NextResponse.json({ error: 'You can suggest up to 5 cities per day. Please try again tomorrow.' }, { status: 429 });
    }

    // Create the suggestion
    const { data: newSuggestion, error: insertError } = await supabaseAdmin
      .from('city_suggestions')
      .insert({
        city_name: cleanCity,
        country: cleanCountry,
        state_region: cleanState,
        created_by: user.id,
        vote_count: 1,
      })
      .select('id, city_name, country, state_region, vote_count')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save suggestion.' }, { status: 500 });
    }

    // Auto-vote for your own suggestion
    await supabaseAdmin
      .from('city_suggestion_votes')
      .insert({ suggestion_id: newSuggestion.id, user_id: user.id });

    return NextResponse.json({
      success: true,
      message: `"${cleanCity}" has been added! Rally your friends to vote for it.`,
      suggestion: newSuggestion,
    });
  }

  return NextResponse.json({ error: 'Invalid action. Use "suggest", "vote", or "unvote".' }, { status: 400 });
}
