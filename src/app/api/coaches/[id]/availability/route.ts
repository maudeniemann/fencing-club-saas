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
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
  }

  const clubId = member.club_id;

  // Get availability slots
  const { data: availabilitySlots } = await client
    .from('availability_slots')
    .select('*')
    .eq('coach_member_id', coachId)
    .eq('club_id', clubId)
    .eq('is_blocked', false)
    .or(`slot_date.gte.${startDate},is_recurring.eq.true`)
    .or(`slot_date.lte.${endDate},is_recurring.eq.true`);

  // Get bookings in this range
  const { data: bookings } = await client
    .from('bookings')
    .select('id, starts_at, ends_at, status')
    .eq('coach_member_id', coachId)
    .eq('club_id', clubId)
    .gte('starts_at', `${startDate}T00:00:00`)
    .lte('starts_at', `${endDate}T23:59:59`)
    .in('status', ['confirmed', 'completed']);

  return NextResponse.json({
    availability_slots: availabilitySlots || [],
    bookings: bookings || [],
  });
}
