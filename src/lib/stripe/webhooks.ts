import { stripe } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export async function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEvent(body, signature, secret);
}

export async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const { booking_id, club_id } = paymentIntent.metadata;

  if (!booking_id || !club_id) return;

  const supabase = createAdminClient();

  // Update payment record
  await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      stripe_charge_id: paymentIntent.latest_charge as string,
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

export async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const { booking_id } = paymentIntent.metadata;

  if (!booking_id) return;

  const supabase = createAdminClient();

  // Update payment status
  await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  // Cancel the booking
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'Payment failed',
    })
    .eq('id', booking_id);
}

export async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;
  const clubId = account.metadata?.club_id;

  if (!clubId) return;

  const supabase = createAdminClient();

  await supabase
    .from('clubs')
    .update({
      stripe_charges_enabled: account.charges_enabled || false,
      stripe_payouts_enabled: account.payouts_enabled || false,
      stripe_onboarding_complete: account.details_submitted || false,
    })
    .eq('id', clubId);
}

export async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;

  if (!paymentIntentId) return;

  const supabase = createAdminClient();

  const refundAmount = charge.amount_refunded;
  const isFullRefund = charge.amount_refunded === charge.amount;

  await supabase
    .from('payments')
    .update({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      refund_amount_cents: refundAmount,
    })
    .eq('stripe_payment_intent_id', paymentIntentId);
}
