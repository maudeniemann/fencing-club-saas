import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const fileDisputeSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  evidence_urls: z.array(z.string().url()).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('disputes')
    .select('*, bookings(booking_number, starts_at, coach:club_members!bookings_coach_member_id_fkey(display_name)), filed_by:club_members!disputes_filed_by_member_id_fkey(display_name)')
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const body = await request.json();
  const parsed = fileDisputeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify the booking exists and is a no-show
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', parsed.data.booking_id)
    .eq('status', 'no_show')
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found or is not a no-show' }, { status: 404 });
  }

  // Get related payment
  const { data: payment } = await admin
    .from('payments')
    .select('id')
    .eq('booking_id', parsed.data.booking_id)
    .eq('payment_type', 'lesson')
    .single();

  const { data: dispute, error } = await admin
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
  await admin.from('bookings').update({ status: 'disputed' }).eq('id', parsed.data.booking_id);

  // Notify all admins
  const { data: admins } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', member.club_id)
    .eq('role', 'admin')
    .eq('is_active', true);

  for (const adminMember of admins || []) {
    await admin.from('notifications').insert({
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
