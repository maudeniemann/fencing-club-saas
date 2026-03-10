import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { z } from 'zod';

const fileDisputeSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  evidence_urls: z.array(z.string().url()).optional(),
});

export async function GET() {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data } = await client
    .from('disputes')
    .select('*, bookings(booking_number, starts_at, coach:club_members!bookings_coach_member_id_fkey(display_name)), filed_by:club_members!disputes_filed_by_member_id_fkey(display_name)')
    .eq('club_id', member.club_id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const body = await request.json();
  const parsed = fileDisputeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify the booking exists and is a no-show
  const { data: booking } = await client
    .from('bookings')
    .select('*')
    .eq('id', parsed.data.booking_id)
    .eq('status', 'no_show')
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found or is not a no-show' }, { status: 404 });
  }

  // Get related payment
  const { data: payment } = await client
    .from('payments')
    .select('id')
    .eq('booking_id', parsed.data.booking_id)
    .eq('payment_type', 'lesson')
    .single();

  const { data: dispute, error } = await client
    .from('disputes')
    .insert({
      club_id: member.club_id,
      booking_id: parsed.data.booking_id,
      payment_id: payment?.id || null,
      filed_by_member_id: member.id,
      reason: parsed.data.reason,
      evidence_urls: parsed.data.evidence_urls || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update booking status
  await client.from('bookings').update({ status: 'disputed' }).eq('id', parsed.data.booking_id);

  // Notify all admins
  const { data: admins } = await client
    .from('club_members')
    .select('id')
    .eq('club_id', member.club_id)
    .eq('role', 'admin')
    .eq('is_active', true);

  for (const adminMember of admins || []) {
    await client.from('notifications').insert({
      club_id: member.club_id,
      recipient_member_id: adminMember.id,
      type: 'dispute_filed',
      title: 'New Dispute Filed',
      body: `A dispute has been filed for booking ${booking.booking_number}.`,
      data: { dispute_id: dispute.id, booking_id: parsed.data.booking_id },
    });
  }

  return NextResponse.json(dispute, { status: 201 });
}
