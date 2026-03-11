import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data, error } = await client
    .from('bookings')
    .select(`
      *,
      lesson_types(*),
      coach:club_members!bookings_coach_member_id_fkey(id, display_name, avatar_url, bio, specialties),
      booking_participants(*, player:club_members!booking_participants_player_member_id_fkey(id, display_name, avatar_url)),
      venue:venues(id, name, address),
      payments(*)
    `)
    .eq('id', bookingId)
    .eq('club_id', member.club_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
