import { requireAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();

    if (authResult.error) {
      return authResult.error;
    }

    const supabase = authResult.supabase!;

    // Get all categories with establishment counts
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug, icon, color, sort_order')
      .order('sort_order', { ascending: true });

    if (catError) {
      throw new Error(`Failed to fetch categories: ${catError.message}`);
    }

    // Get establishment counts per category
    const { data: counts, error: countError } = await supabase
      .from('establishments')
      .select('category_id')
      .eq('status', 'ACTIVE');

    const countMap: Record<string, number> = {};
    if (!countError && counts) {
      counts.forEach((est: { category_id: string }) => {
        countMap[est.category_id] = (countMap[est.category_id] || 0) + 1;
      });
    }

    const categoriesWithCounts = (categories || []).map((cat: any) => ({
      ...cat,
      establishmentCount: countMap[cat.id] || 0,
    }));

    return NextResponse.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error('Admin categories GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
