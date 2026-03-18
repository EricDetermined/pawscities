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
      .from('Photo')
      .select('id, url, userId, establishmentId, status')
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
      .from('Photo')
      .update({ status: newStatus })
      .eq('id', photoId);

    if (updateError) {
      throw new Error(`Failed to update photo: ${updateError.message}`);
    }

    // If approved, add to establishment's images array
    if (action === 'approve') {
      // Get current establishment images
      const { data: establishment } = await supabase
        .from('Establishment')
        .select('images, primaryImage')
        .eq('id', photo.establishmentId)
        .single();

      if (establishment) {
        const currentImages = establishment.images || [];
        // Add approved photo URL to the front of the images array (user photos first)
        const updatedImages = [photo.url, ...currentImages.filter((img: string) => img !== photo.url)];

        const updateData: Record<string, unknown> = {
          images: updatedImages,
          updatedAt: new Date().toISOString(),
        };

        // Set as primary image if none exists
        if (!establishment.primaryImage) {
          updateData.primaryImage = photo.url;
        }

        await supabase
          .from('Establishment')
          .update(updateData)
          .eq('id', photo.establishmentId);
      }
    }

    // If rejected and was previously in images array, remove it
    if (action === 'reject') {
      const { data: establishment } = await supabase
        .from('Establishment')
        .select('images, primaryImage')
        .eq('id', photo.establishmentId)
        .single();

      if (establishment) {
        const currentImages = establishment.images || [];
        const updatedImages = currentImages.filter((img: string) => img !== photo.url);

        const updateData: Record<string, unknown> = {
          images: updatedImages,
          updatedAt: new Date().toISOString(),
        };

        // If this was the primary image, clear it
        if (establishment.primaryImage === photo.url) {
          updateData.primaryImage = updatedImages[0] || null;
        }

        await supabase
          .from('Establishment')
          .update(updateData)
          .eq('id', photo.establishmentId);
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
