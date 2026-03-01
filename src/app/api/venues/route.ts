import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createVenueSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('venues')
    .select('*, strips(*)')
    .eq('is_active', true)
    .order('name');
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createVenueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from('venues')
    .insert({ club_id: member.club_id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
