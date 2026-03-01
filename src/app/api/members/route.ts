import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  let query = supabase
    .from('club_members')
    .select('*')
    .eq('is_active', true)
    .order('display_name');

  if (role) query = query.eq('role', role);

  const { data } = await query;
  return NextResponse.json(data || []);
}
