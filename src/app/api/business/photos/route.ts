import { requireBusinessOrAdmin, getEstablishmentForUser } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

const TIER_LIMITS: Record<string, number> = {
  free: 1,
  premium: 10,
};

export async function GET() {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();
  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    // Get the establishment for this user (handles admin fallback)
    const result = await getEstablishmentForUser(supabase, dbUser);

    if (!result) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    const claim = result;

    // Get photos for this establishment (admins see all photos, business users see their own)
    const photosQuery = supabase
      .from('photos')
      .select('id, url, caption, status, created_at')
      .eq('establishment_id', claim.establishmentId)
      .order('created_at', { ascending: false });

    // Non-admin users only see their own photos
    if (dbUser.role !== 'ADMIN') {
      photosQuery.eq('user_id', dbUser.id);
    }

    const { data: photos, error: photosError } = await photosQuery;

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    // Get establishment details including Google photo refs
    const { data: establishment } = await supabase
      .from('establishments')
      .select('photo_refs, google_place_id, primary_image')
      .eq('id', claim.establishmentId)
      .single();

    // Build Google photo URLs from photo_refs (these are Google Places photo name references)
    const googlePhotos = (establishment?.photo_refs || [])
      .filter((ref: string) => ref && ref.startsWith('places/'))
      .map((ref: string, index: number) => ({
        photoRef: ref,
        url: `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=800`,
        thumbnailUrl: `/api/places/photo?name=${encodeURIComponent(ref)}&maxWidth=400`,
        label: index === 0 ? 'Main Google Business Photo' : `Google Business Photo ${index + 1}`,
      }));

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('establishment_id', claim.establishmentId)
      .eq('status', 'ACTIVE')
      .single();

    const tier = subscription?.tier || 'free';
    const maxPhotos = TIER_LIMITS[tier] || 1;

    return NextResponse.json({
      photos: photos || [],
      googlePhotos,
      googlePlaceId: establishment?.google_place_id || null,
      tier,
      maxPhotos,
      establishmentId: claim.establishmentId,
    });
  } catch (error) {
    console.error('Business photos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();
  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { urls, captions } = body as { urls: string[]; captions?: string[] };

    if (!urls || urls.length === 0) {
      return NextResponse.json({ error: 'No photo URLs provided' }, { status: 400 });
    }

    // Get the establishment for this user (handles admin fallback)
    const estResult = await getEstablishmentForUser(supabase, dbUser);
    if (!estResult) {
      return NextResponse.json({ error: 'No approved business claim found' }, { status: 404 });
    }

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('establishment_id', estResult.establishmentId)
      .eq('status', 'ACTIVE')
      .single();

    const tier = subscription?.tier || 'free';
    const maxPhotos = TIER_LIMITS[tier] || 1;

    // Check existing photo count
    const { count: existingCount } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('establishment_id', estResult.establishmentId)
      .eq('user_id', dbUser.id)
      .neq('status', 'REJECTED');

    const currentCount = existingCount || 0;

    if (currentCount + urls.length > maxPhotos) {
      return NextResponse.json({
        error: `Photo limit exceeded. Your ${tier} plan allows ${maxPhotos} photo${maxPhotos !== 1 ? 's' : ''}. You currently have ${currentCount} and are trying to add ${urls.length}.`,
      }, { status: 400 });
    }

    // Insert photos with PENDING status
    const photoRecords = urls.map((url, idx) => ({
      user_id: dbUser.id,
      establishment_id: estResult.establishmentId,
      url,
      caption: captions?.[idx] || null,
      status: 'PENDING',
    }));

    const { data: photos, error: insertError } = await supabase
      .from('photos')
      .insert(photoRecords)
      .select('id, url, caption, status, created_at');

    if (insertError) {
      throw new Error(`Failed to save photos: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      photos: photos || [],
      message: `${urls.length} photo${urls.length !== 1 ? 's' : ''} uploaded and pending review.`,
    });
  } catch (error) {
    console.error('Business photos POST error:', error);
    return NextResponse.json({ error: 'Failed to save photos' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { error, supabase, dbUser } = await requireBusinessOrAdmin();
  if (error) return error;
  if (!supabase || !dbUser) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const { photoId } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    // Verify ownership: photo must belong to this user
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, url, user_id')
      .eq('id', photoId)
      .eq('user_id', dbUser.id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found or access denied' }, { status: 404 });
    }

    // Delete from Supabase Storage if it's a Supabase URL
    if (photo.url.includes('supabase')) {
      const urlPath = new URL(photo.url).pathname;
      const storagePath = urlPath.split('/storage/v1/object/public/photos/')[1];
      if (storagePath) {
        await supabase.storage.from('photos').remove([storagePath]);
      }
    }

    // Delete the record
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      throw new Error(`Failed to delete photo: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    console.error('Business photos DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
