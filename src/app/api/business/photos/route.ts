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

    // Get photos for this establishment
    // Table is "Photo" with camelCase columns (establishmentId, userId, isApproved, createdAt)
    const photosQuery = supabase
      .from('Photo')
      .select('id, url, caption, isApproved, createdAt, userId')
      .eq('establishmentId', claim.establishmentId)
      .order('createdAt', { ascending: false });

    // Non-admin users only see their own photos
    if (dbUser.role !== 'ADMIN') {
      photosQuery.eq('userId', dbUser.id);
    }

    const { data: photos, error: photosError } = await photosQuery;

    if (photosError) {
      console.error('Photos query error:', photosError);
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    // Normalize photo data to match frontend expectations
    const normalizedPhotos = (photos || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      url: p.url,
      caption: p.caption || null,
      status: p.isApproved ? 'APPROVED' : 'PENDING',
      created_at: p.createdAt,
    }));

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
      photos: normalizedPhotos,
      googlePhotos,
      googlePlaceId: establishment?.google_place_id || null,
      primaryImage: establishment?.primary_image || null,
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

    // Check existing photo count using Photo table (camelCase)
    const { count: existingCount } = await supabase
      .from('Photo')
      .select('*', { count: 'exact', head: true })
      .eq('establishmentId', estResult.establishmentId)
      .eq('userId', dbUser.id);

    const currentCount = existingCount || 0;

    if (currentCount + urls.length > maxPhotos) {
      return NextResponse.json({
        error: `Photo limit exceeded. Your ${tier} plan allows ${maxPhotos} photo${maxPhotos !== 1 ? 's' : ''}. You currently have ${currentCount} and are trying to add ${urls.length}.`,
      }, { status: 400 });
    }

    // Insert photos with pending status using Photo table (camelCase)
    const photoRecords = urls.map((url, idx) => ({
      userId: dbUser.id,
      establishmentId: estResult.establishmentId,
      url,
      caption: captions?.[idx] || null,
      isApproved: false,
    }));

    const { data: photos, error: insertError } = await supabase
      .from('Photo')
      .insert(photoRecords)
      .select('id, url, caption, isApproved, createdAt');

    if (insertError) {
      throw new Error(`Failed to save photos: ${insertError.message}`);
    }

    const normalizedPhotos = (photos || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      url: p.url,
      caption: p.caption || null,
      status: p.isApproved ? 'APPROVED' : 'PENDING',
      created_at: p.createdAt,
    }));

    return NextResponse.json({
      success: true,
      photos: normalizedPhotos,
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

    // Verify ownership: photo must belong to this user (using Photo table, camelCase)
    const { data: photo, error: photoError } = await supabase
      .from('Photo')
      .select('id, url, userId')
      .eq('id', photoId)
      .eq('userId', dbUser.id)
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
      .from('Photo')
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
