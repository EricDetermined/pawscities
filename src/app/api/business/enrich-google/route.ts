import { NextResponse } from 'next/server';
import { requireBusinessOrAdmin } from '@/lib/admin';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { searchPlace, getPhotoUrl } from '@/lib/google-places';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/business/enrich-google
 * Re-enriches the business owner's establishment with fresh Google Places data.
 * Pulls: photos, coordinates, phone, website, rating, review count, Google Maps URL
 */
export async function POST() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();
  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the business's approved claim
    const { data: claim } = await supabase
      .from('business_claims')
      .select('establishment_id')
      .eq('user_id', dbUser.id)
      .eq('status', 'APPROVED')
      .single();

    if (!claim) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get the establishment
    const supabaseAdmin = getSupabaseAdmin();
    const { data: est } = await supabaseAdmin
      .from('establishments')
      .select('id, name, address, city_id, google_place_id')
      .eq('id', claim.establishment_id)
      .single();

    if (!est) {
      return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
    }

    // Look up city name for better search query
    const { data: cityData } = await supabaseAdmin
      .from('cities')
      .select('name')
      .eq('id', est.city_id)
      .single();
    const cityName = cityData?.name || '';

    // Search Google Places
    const searchQuery = `${est.name} ${est.address || ''} ${cityName}`;
    const placeResult = await searchPlace(searchQuery);

    if (!placeResult) {
      return NextResponse.json({
        success: false,
        error: `No Google match found for "${est.name}". Try uploading a photo manually instead.`,
      }, { status: 404 });
    }

    // Build enrichment update
    const photoRefs = (placeResult.photos || []).slice(0, 5).map((p: { name: string }) => p.name);
    const enrichment: Record<string, unknown> = {
      google_place_id: placeResult.id,
      google_maps_url: placeResult.googleMapsUri || null,
      photo_refs: photoRefs,
      updated_at: new Date().toISOString(),
    };

    if (photoRefs.length > 0) {
      enrichment.primary_image = getPhotoUrl(photoRefs[0], 800);
    }
    if (placeResult.location?.latitude && placeResult.location?.longitude) {
      enrichment.latitude = placeResult.location.latitude;
      enrichment.longitude = placeResult.location.longitude;
    }
    if (placeResult.internationalPhoneNumber && !est.address) {
      enrichment.phone = placeResult.internationalPhoneNumber;
    }
    if (placeResult.websiteUri) {
      enrichment.website = placeResult.websiteUri;
    }
    if (placeResult.rating) {
      enrichment.rating = placeResult.rating;
      enrichment.review_count = placeResult.userRatingCount || 0;
    }

    // Update the establishment
    const { error: updateError } = await supabaseAdmin
      .from('establishments')
      .update(enrichment)
      .eq('id', est.id);

    if (updateError) {
      return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Found "${placeResult.displayName?.text || est.name}" on Google with ${photoRefs.length} photo(s)`,
      googlePlaceId: placeResult.id,
      photosFound: photoRefs.length,
      rating: placeResult.rating || null,
      reviewCount: placeResult.userRatingCount || null,
    });
  } catch (err) {
    console.error('Google enrich error:', err);
    return NextResponse.json({ error: 'Failed to enrich from Google' }, { status: 500 });
  }
}
