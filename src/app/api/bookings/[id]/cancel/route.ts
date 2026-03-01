import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCancellationFee, createRefund } from '@/lib/stripe/payments';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const reason = body.reason || 'Cancelled by user';

  // Get booking with payment info
  const { data: booking } = await admin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 400 });
  }

  // Get club for cancellation policy
  const { data: club } = await admin
    .from('clubs')
    .select('default_cancellation_policy')
    .eq('id', booking.club_id)
    .single();

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

  // Get the original payment
  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('payment_type', 'lesson')
    .eq('status', 'succeeded')
    .single();

  // Calculate fee
  const { feeCents, refundCents } = calculateCancellationFee(
    payment?.amount_cents || 0,
    new Date(booking.starts_at),
    club.default_cancellation_policy
  );

  // Process refund via Stripe if applicable
  if (payment?.stripe_payment_intent_id && refundCents > 0) {
    try {
      const refund = await createRefund(
        payment.stripe_payment_intent_id,
        refundCents,
        reason
      );

      await admin.from('payments').update({
        status: refundCents === payment.amount_cents ? 'refunded' : 'partially_refunded',
        refund_amount_cents: refundCents,
        stripe_refund_id: refund.id,
      }).eq('id', payment.id);

      // Create cancellation fee payment record if there's a fee
      if (feeCents > 0) {
        await admin.from('payments').insert({
          club_id: booking.club_id,
          booking_id: bookingId,
          payer_member_id: payment.payer_member_id,
          player_member_id: payment.player_member_id,
          amount_cents: feeCents,
          platform_fee_cents: 0,
          club_amount_cents: feeCents,
          payment_type: 'cancellation_fee',
          status: 'succeeded',
          description: `Late cancellation fee (${club.default_cancellation_policy.late_cancel_charge_percent}%)`,
        });
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Refund failed: ' + (err instanceof Error ? err.message : 'Unknown error') },
        { status: 500 }
      );
    }
  }

  // Update booking
  await admin.from('bookings').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason,
    cancellation_fee_cents: feeCents,
  }).eq('id', bookingId);

  // Update participant status
  await admin.from('booking_participants')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId);

  // Notify coach
  await admin.from('notifications').insert({
    club_id: booking.club_id,
    recipient_member_id: booking.coach_member_id,
    type: 'booking_cancelled',
    title: 'Lesson Cancelled',
    body: `A lesson on ${new Date(booking.starts_at).toLocaleDateString()} has been cancelled.`,
    data: { booking_id: bookingId, cancellation_fee_cents: feeCents },
  });

  // Trigger waitlist cascade (import dynamically to avoid circular deps)
  const { triggerWaitlistCascade } = await import('@/lib/waitlist/cascade');
  await triggerWaitlistCascade(booking, admin);

  return NextResponse.json({
    success: true,
    cancellation_fee_cents: feeCents,
    refund_cents: refundCents,
  });
}
