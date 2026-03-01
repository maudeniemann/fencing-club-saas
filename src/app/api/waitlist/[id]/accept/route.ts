import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: entryId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get the waitlist entry
  const { data: entry } = await admin
    .from('waitlist_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (entry.status !== 'notified') {
    return NextResponse.json({ error: 'This offer is no longer available' }, { status: 400 });
  }

  // Check deadline
  if (new Date() > new Date(entry.accept_deadline)) {
    await admin.from('waitlist_entries').update({ status: 'expired' }).eq('id', entryId);
    return NextResponse.json({ error: 'Acceptance window has expired' }, { status: 410 });
  }

  // Create the booking via the bookings API internally
  // This reuses all the payment, conflict check, and notification logic
  const bookingResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify({
      coach_member_id: entry.coach_member_id,
      lesson_type_id: entry.lesson_type_id,
      starts_at: `${entry.desired_date}T${entry.desired_start_time || '09:00:00'}`,
      player_member_id: entry.player_member_id,
    }),
  });

  if (!bookingResponse.ok) {
    const err = await bookingResponse.json();
    return NextResponse.json({ error: err.error || 'Failed to create booking' }, { status: 500 });
  }

  const bookingData = await bookingResponse.json();

  // Update waitlist entry
  await admin.from('waitlist_entries').update({
    status: 'accepted',
    responded_at: new Date().toISOString(),
    resulting_booking_id: bookingData.booking.id,
  }).eq('id', entryId);

  // Mark all other waiting/notified entries for same coach+date as fulfilled
  await admin
    .from('waitlist_entries')
    .update({ status: 'fulfilled' })
    .eq('coach_member_id', entry.coach_member_id)
    .eq('desired_date', entry.desired_date)
    .neq('id', entryId)
    .in('status', ['waiting', 'notified']);

  return NextResponse.json({
    success: true,
    booking: bookingData.booking,
  });
}
