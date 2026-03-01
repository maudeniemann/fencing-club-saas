import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get current member (must be coach or admin)
  const { data: currentMember } = await supabase
    .from('club_members')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!currentMember || (currentMember.role !== 'coach' && currentMember.role !== 'admin')) {
    return NextResponse.json({ error: 'Only coaches and admins can report no-shows' }, { status: 403 });
  }

  // Get booking
  const { data: booking } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return NextResponse.json({ error: 'Cannot report no-show for this booking' }, { status: 400 });
  }

  // Verify coach owns this booking (unless admin)
  if (currentMember.role === 'coach' && booking.coach_member_id !== currentMember.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }

  // Update booking to no-show
  await admin.from('bookings').update({
    status: 'no_show',
    no_show_reported_at: new Date().toISOString(),
    no_show_reported_by: currentMember.id,
  }).eq('id', bookingId);

  // Update participant status
  await admin.from('booking_participants')
    .update({ status: 'no_show' })
    .eq('booking_id', bookingId);

  // Original payment stays — player was already charged at booking time.
  // Coach will receive their payout as normal.

  // Notify each participant (player/parent)
  const { data: participants } = await admin
    .from('booking_participants')
    .select('player_member_id, booked_by_member_id')
    .eq('booking_id', bookingId);

  const recipientIds = new Set<string>();
  for (const p of participants || []) {
    recipientIds.add(p.player_member_id);
    if (p.booked_by_member_id) recipientIds.add(p.booked_by_member_id);
  }

  for (const recipientId of recipientIds) {
    await admin.from('notifications').insert({
      club_id: booking.club_id,
      recipient_member_id: recipientId,
      type: 'no_show_reported',
      title: 'No-Show Reported',
      body: `You were marked as a no-show for booking ${booking.booking_number}. You may file a dispute if you believe this is an error.`,
      data: { booking_id: bookingId },
    });
  }

  return NextResponse.json({ success: true });
}
