import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { id: coachId } = await params;

  const { data: coach, error } = await client
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
