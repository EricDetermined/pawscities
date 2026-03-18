import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const supabase = authResult.supabase!;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'PENDING';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));
    const offset = (page - 1) * limit;

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    const statusFilter = validStatuses.includes(status) ? status : 'PENDING';

    // Get total count
    const { count: totalCount } = await supabase
      .from('Photo')
      .select('*', { count: 'exact', head: true })
      .eq('status', statusFilter);

    // Get photos
    const { data: photos, error: photosError } = await supabase
      .from('Photo')
      .select('*')
      .eq('status', statusFilter)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    // Enrich with establishment and user data
    const enrichedPhotos = await Promise.all(
      (photos || []).map(async (photo: Record<string, unknown>) => {
        const [estResult, userResult] = await Promise.all([
          supabase
            .from('Establishment')
            .select('id, name, slug, cityId, tier')
            .eq('id', photo.establishmentId)
            .single(),
          supabase
            .from('User')
            .select('id, email, name')
            .eq('id', photo.userId)
            .single(),
        ]);

        return {
          ...photo,
          establishment: estResult.data,
          user: userResult.data,
        };
      })
    );

    return NextResponse.json({
      photos: enrichedPhotos,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin photos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}
