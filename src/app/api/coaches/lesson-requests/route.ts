import { NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';

export async function GET() {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'coach' && member.role !== 'admin') {
    return NextResponse.json({ error: 'Coaches only' }, { status: 403 });
  }

  // Fetch all waitlist + lesson requests for this coach
  const { data, error } = await client
    .from('waitlist_entries')
    .select(`
      *,
      player:club_members!waitlist_entries_player_member_id_fkey(id, display_name, avatar_url, phone),
      lesson_type:lesson_types(id, name, duration_minutes, price_cents, category)
    `)
    .eq('coach_member_id', member.id)
    .in('status', ['waiting', 'notified'])
    .order('is_new_time_request', { ascending: true })
    .order('priority_score', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}
