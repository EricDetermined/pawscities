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
      .from('Category')
      .select('id, name, slug, icon, color, sortOrder')
      .order('sortOrder', { ascending: true });

    if (catError) {
      throw new Error(`Failed to fetch categories: ${catError.message}`);
    }

    // Get establishment counts per category
    const { data: counts, error: countError } = await supabase
      .from('Establishment')
      .select('categoryId')
      .eq('status', 'ACTIVE');

    const countMap: Record<string, number> = {};
    if (!countError && counts) {
      counts.forEach((est: { categoryId: string }) => {
        countMap[est.categoryId] = (countMap[est.categoryId] || 0) + 1;
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
