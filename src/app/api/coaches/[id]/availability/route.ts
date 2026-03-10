import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { client: supabase, user } = await getDemoSafeClient();

  const { id: coachId } = await params;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
  }

  // Resolve club_id from user membership or from the coach record
  let clubId: string | undefined;
  if (user) {
    const { data: member } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });
    clubId = member.club_id;
  } else {
    const { data: coachData } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('id', coachId)
      .single();
    clubId = coachData?.club_id;
  }

  if (!clubId) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

  // Get availability slots
  const { data: availabilitySlots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('coach_member_id', coachId)
    .eq('club_id', clubId)
    .eq('is_blocked', false)
    .or(`slot_date.gte.${startDate},is_recurring.eq.true`)
    .or(`slot_date.lte.${endDate},is_recurring.eq.true`);

  // Get bookings in this range
  const { data: bookings } = await supabase
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
