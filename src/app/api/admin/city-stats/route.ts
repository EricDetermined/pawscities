import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Get all cities with their IDs and slugs
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, slug, name')
      .order('name');

    if (citiesError) {
      throw new Error(`Failed to fetch cities: ${citiesError.message}`);
    }

    // Get establishment counts per city
    const counts: Record<string, number> = {};

    for (const city of cities || []) {
      const { count } = await supabase
        .from('establishments')
        .select('*', { count: 'exact', head: true })
        .eq('city_id', city.id);

      counts[city.slug] = count || 0;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error('Admin city-stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch city stats' },
      { status: 500 }
    );
  }
}
