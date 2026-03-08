import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  
  // Calculate previous month date range
  const previousMonth = subMonths(new Date(), 1);
  const periodStart = startOfMonth(previousMonth);
  const periodEnd = endOfMonth(previousMonth);

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ member_id: string; error: string }>,
  };

  try {
    // Get all players with auto-billing enabled
    const { data: members } = await admin
      .from('club_members')
      .select('id, club_id, display_name, stripe_customer_id, stripe_default_payment_method_id')
      .eq('auto_billing_enabled', true)
      .eq('role', 'player')
      .eq('is_active', true)
      .not('stripe_customer_id', 'is', null)
      .not('stripe_default_payment_method_id', 'is', null);

    if (!members || members.length === 0) {
      return NextResponse.json({ message: 'No members to process', ...results });
    }

    // Process each member
    for (const member of members) {
      results.processed++;

      try {
        // Get club for Stripe account
        const { data: club } = await admin
          .from('clubs')
          .select('id, stripe_account_id, stripe_charges_enabled')
          .eq('id', member.club_id)
          .single();

        if (!club?.stripe_account_id || !club.stripe_charges_enabled) {
          results.errors.push({
            member_id: member.id,
            error: 'Club Stripe not configured',
          });
          results.failed++;
          continue;
        }

        // Get completed bookings from previous month without payment
        const { data: participants } = await admin
          .from('booking_participants')
          .select(`
            id,
            booking_id,
            price_charged_cents,
            payment_id,
            bookings!inner(
              id,
              starts_at,
              status,
              coach_member_id,
              lesson_type_id
            )
          `)
          .eq('player_member_id', member.id)
          .eq('club_id', member.club_id)
          .is('payment_id', null)
          .gte('bookings.starts_at', periodStart.toISOString())
          .lte('bookings.starts_at', periodEnd.toISOString())
          .eq('bookings.status', 'completed');

        if (!participants || participants.length === 0) {
          // No completed bookings to charge
          continue;
        }

        // Calculate total amount
        const totalCents = participants.reduce((sum, p) => sum + p.price_charged_cents, 0);

        if (totalCents === 0) {
          continue;
        }

        // Calculate platform fee (assuming 5% like PLATFORM_FEE_PERCENT)
        const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5') / 100;
        const platformFeeCents = Math.round(totalCents * platformFeePercent);
        const clubAmountCents = totalCents - platformFeeCents;

        // Create Stripe payment intent (off-session)
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: totalCents,
            currency: 'usd',
            customer: member.stripe_customer_id,
            payment_method: member.stripe_default_payment_method_id,
            off_session: true,
            confirm: true,
            description: `Monthly auto-billing for ${participants.length} completed lesson(s)`,
            metadata: {
              member_id: member.id,
              club_id: member.club_id,
              booking_count: participants.length.toString(),
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
            },
            application_fee_amount: platformFeeCents,
          },
          {
            stripeAccount: club.stripe_account_id,
          }
        );

        if (paymentIntent.status !== 'succeeded') {
          results.errors.push({
            member_id: member.id,
            error: `Payment intent status: ${paymentIntent.status}`,
          });
          results.failed++;
          
          // Notify member of failure
          await admin.from('notifications').insert({
            club_id: member.club_id,
            recipient_member_id: member.id,
            type: 'auto_billing_failed',
            title: 'Auto-billing Failed',
            body: `We were unable to charge your card for completed lessons. Please update your payment method.`,
            channel: 'in_app',
          });
          
          continue;
        }

        // Create payment record
        const { data: payment } = await admin
          .from('payments')
          .insert({
            club_id: member.club_id,
            booking_id: null, // Multiple bookings
            payer_member_id: member.id,
            player_member_id: member.id,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_charge_id: paymentIntent.latest_charge as string,
            amount_cents: totalCents,
            platform_fee_cents: platformFeeCents,
            club_amount_cents: clubAmountCents,
            currency: 'usd',
            payment_type: 'lesson',
            status: 'succeeded',
            description: `Auto-billing for ${participants.length} completed lesson(s) from ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}`,
          })
          .select()
          .single();

        if (!payment) {
          results.errors.push({
            member_id: member.id,
            error: 'Failed to create payment record',
          });
          results.failed++;
          continue;
        }

        // Update booking_participants with payment_id
        await admin
          .from('booking_participants')
          .update({ payment_id: payment.id })
          .in('id', participants.map(p => p.id));

        // Notify member of success
        await admin.from('notifications').insert({
          club_id: member.club_id,
          recipient_member_id: member.id,
          type: 'auto_billing_success',
          title: 'Monthly Billing Complete',
          body: `Your card was charged $${(totalCents / 100).toFixed(2)} for ${participants.length} completed lesson(s).`,
          data: { payment_id: payment.id },
          channel: 'in_app',
        });

        results.succeeded++;
      } catch (error) {
        results.errors.push({
          member_id: member.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        results.failed++;

        // Notify member of failure
        await admin.from('notifications').insert({
          club_id: member.club_id,
          recipient_member_id: member.id,
          type: 'auto_billing_failed',
          title: 'Auto-billing Failed',
          body: `We encountered an error processing your monthly billing. Please contact support.`,
          channel: 'in_app',
        });
      }
    }

    return NextResponse.json({
      message: 'Auto-billing completed',
      ...results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process auto-billing',
        ...results,
      },
      { status: 500 }
    );
  }
}
