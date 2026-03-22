import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type === 'opportunities') {
    const { data } = await supabase
      .from('social_opportunities')
      .select('*')
      .eq('status', 'new')
      .order('likes', { ascending: false })
      .limit(50);
    return NextResponse.json({ opportunities: data || [] });
  }

  if (type === 'comments') {
    const { data } = await supabase
      .from('social_comments')
      .select('*')
      .eq('replied', false)
      .order('commented_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ comments: data || [] });
  }

  return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const { error, supabase } = await requireAdmin();
  if (error) return error;
  if (!supabase) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

  const { id, type, status, replied } = await request.json();

  if (type === 'opportunity' && id && status) {
    await supabase
      .from('social_opportunities')
      .update({ status, engaged_at: status === 'engaged' ? new Date().toISOString() : null })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (type === 'comment' && id && replied !== undefined) {
    await supabase
      .from('social_comments')
      .update({ replied, replied_at: replied ? new Date().toISOString() : null })
      .eq('id', id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
