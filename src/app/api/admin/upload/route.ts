import { requireAdmin } from '@/lib/admin';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const establishmentId = formData.get('establishmentId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!establishmentId) {
      return NextResponse.json({ error: 'Establishment ID required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `establishments/${establishmentId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabaseAdmin.storage
      .from('photos')
      .getPublicUrl(fileName);

    // Also update the establishment's primary_image
    await supabaseAdmin
      .from('establishments')
      .update({
        primary_image: publicUrl.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', establishmentId);

    return NextResponse.json({
      url: publicUrl.publicUrl,
      fileName,
    });
  } catch (error) {
    console.error('Admin upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
