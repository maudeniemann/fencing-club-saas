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
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
  }

  // Get availability slots
  const { data: availabilitySlots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('coach_member_id', coachId)
    .eq('club_id', member.club_id)
    .eq('is_blocked', false)
    .or(`slot_date.gte.${startDate},is_recurring.eq.true`)
    .or(`slot_date.lte.${endDate},is_recurring.eq.true`);

  // Get bookings in this range
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, starts_at, ends_at, status')
    .eq('coach_member_id', coachId)
    .eq('club_id', member.club_id)
    .gte('starts_at', `${startDate}T00:00:00`)
    .lte('starts_at', `${endDate}T23:59:59`)
    .in('status', ['confirmed', 'completed']);

  return NextResponse.json({
    availability_slots: availabilitySlots || [],
    bookings: bookings || [],
  });
}
