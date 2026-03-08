import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const { id: coachId } = await params;

  const { data: coach, error } = await supabase
    .from('club_members')
    .select('id, display_name, bio, specialties, avatar_url')
    .eq('id', coachId)
    .eq('club_id', member.club_id)
    .eq('role', 'coach')
    .eq('is_active', true)
    .single();

  if (error || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  return NextResponse.json(coach);
}
