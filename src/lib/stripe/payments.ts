import { stripe } from './client';
import type { Club, ClubMember, LessonType } from '@/types';

const PLATFORM_FEE_PERCENT = parseInt(process.env.PLATFORM_FEE_PERCENT || '5', 10);

interface CreatePaymentIntentParams {
  club: Club;
  payer: ClubMember;
  lessonType: LessonType;
  bookingId: string;
  playerMemberId: string;
  coachMemberId: string;
}

export async function createLessonPaymentIntent({
  club,
  payer,
  lessonType,
  bookingId,
  playerMemberId,
  coachMemberId,
}: CreatePaymentIntentParams) {
  if (!club.stripe_account_id || !club.stripe_charges_enabled) {
    throw new Error('Club has not completed Stripe onboarding');
  }

  if (!payer.stripe_customer_id) {
    throw new Error('Payer does not have a Stripe customer ID');
  }

  const platformFee = Math.round(lessonType.price_cents * PLATFORM_FEE_PERCENT / 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: lessonType.price_cents,
    currency: lessonType.currency || 'usd',
    customer: payer.stripe_customer_id,
    payment_method: payer.stripe_default_payment_method_id || undefined,
    application_fee_amount: platformFee,
    transfer_data: {
      destination: club.stripe_account_id,
    },
    metadata: {
      club_id: club.id,
      booking_id: bookingId,
      player_member_id: playerMemberId,
      coach_member_id: coachMemberId,
      payer_member_id: payer.id,
    },
    automatic_payment_methods: { enabled: true },
  });

  return {
    paymentIntent,
    platformFeeCents: platformFee,
    clubAmountCents: lessonType.price_cents - platformFee,
  };
}

export async function createRefund(
  paymentIntentId: string,
  amountCents: number,
  reason: string
) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amountCents,
    reason: 'requested_by_customer',
    metadata: { reason },
  });
}

export async function chargeNoShowFee(
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  clubStripeAccountId: string,
  metadata: Record<string, string>
) {
  const platformFee = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100);

  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    application_fee_amount: platformFee,
    transfer_data: {
      destination: clubStripeAccountId,
    },
    metadata,
  });
}

export function calculateCancellationFee(
  priceCents: number,
  startsAt: Date,
  policy: { free_cancel_hours: number; late_cancel_charge_percent: number }
): { feeCents: number; refundCents: number } {
  const now = new Date();
  const hoursUntilLesson = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilLesson > policy.free_cancel_hours) {
    return { feeCents: 0, refundCents: priceCents };
  }

  if (hoursUntilLesson > 0) {
    const feeCents = Math.round(priceCents * policy.late_cancel_charge_percent / 100);
    return { feeCents, refundCents: priceCents - feeCents };
  }

  // Past lesson start — full charge
  return { feeCents: priceCents, refundCents: 0 };
}
