import { NextRequest, NextResponse } from 'next/server';
import {
  constructWebhookEvent,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleAccountUpdated,
  handleChargeRefunded,
} from '@/lib/stripe/webhooks';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Determine which webhook secret to use
  // Stripe Connect events use a different secret
  let event;
  try {
    event = await constructWebhookEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    // Try Connect webhook secret
    try {
      event = await constructWebhookEvent(
        body,
        signature,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
      );
    } catch (err) {
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown'}` },
        { status: 400 }
      );
    }
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;
      case 'account.updated':
        await handleAccountUpdated(event);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;
      default:
        // Unhandled event type — log but don't error
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
