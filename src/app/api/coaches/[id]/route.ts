import { NextRequest, NextResponse } from 'next/server';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { client: supabase, member } = await getDemoSafeClient();

  if (!member) {
    return NextResponse.json({ error: 'No membership' }, { status: 403 });
  }

  const { id: coachId } = await params;

  const { data: coach, error } = await supabase
    .from('club_members')
    .select('id, display_name, bio, specialties, avatar_url')
    .eq('id', coachId)
    .eq('role', 'coach')
    .eq('is_active', true)
    .eq('club_id', member.club_id)
    .single();

  if (error || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  return NextResponse.json(coach);
}
