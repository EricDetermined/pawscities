import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = authResult.supabase!;
    const photoId = params.id;
    const body = await request.json();
    const { action, reviewNotes } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get the photo
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, url, user_id, establishment_id, status')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (photo.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending photos can be reviewed' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update photo status
    const { error: updateError } = await supabase
      .from('photos')
      .update({ status: newStatus })
      .eq('id', photoId);

    if (updateError) {
      throw new Error(`Failed to update photo: ${updateError.message}`);
    }

    // If approved, add to establishment's photo_refs array
    if (action === 'approve') {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('photo_refs, primary_image')
        .eq('id', photo.establishment_id)
        .single();

      if (establishment) {
        const currentImages = establishment.photo_refs || [];
        const updatedImages = [photo.url, ...currentImages.filter((img: string) => img !== photo.url)];

        const updateData: Record<string, unknown> = {
          photo_refs: updatedImages,
        };

        if (!establishment.primary_image) {
          updateData.primary_image = photo.url;
        }

        await supabase
          .from('establishments')
          .update(updateData)
          .eq('id', photo.establishment_id);
      }
    }

    // If rejected, remove from images array if present
    if (action === 'reject') {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('photo_refs, primary_image')
        .eq('id', photo.establishment_id)
        .single();

      if (establishment) {
        const currentImages = establishment.photo_refs || [];
        const updatedImages = currentImages.filter((img: string) => img !== photo.url);

        const updateData: Record<string, unknown> = {
          photo_refs: updatedImages,
        };

        if (establishment.primary_image === photo.url) {
          updateData.primary_image = updatedImages[0] || null;
        }

        await supabase
          .from('establishments')
          .update(updateData)
          .eq('id', photo.establishment_id);
      }
    }

    return NextResponse.json({
      id: photoId,
      status: newStatus,
      message: `Photo ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Admin photo PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 });
  }
}
