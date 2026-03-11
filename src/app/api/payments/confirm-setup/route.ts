import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe } from '@/lib/stripe/client';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, stripe_customer_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  const body = await request.json();
  const { setup_intent_id } = body;

  if (!setup_intent_id) {
    return NextResponse.json({ error: 'setup_intent_id is required' }, { status: 400 });
  }

  // Retrieve the SetupIntent from Stripe
  const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id);

  if (setupIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'SetupIntent has not succeeded' }, { status: 400 });
  }

  const paymentMethodId = setupIntent.payment_method as string;

  // Set as default payment method on the customer
  if (member.stripe_customer_id) {
    await stripe.customers.update(member.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  // Save to club_members
  await admin
    .from('club_members')
    .update({ stripe_default_payment_method_id: paymentMethodId })
    .eq('id', member.id);

  return NextResponse.json({ success: true, payment_method_id: paymentMethodId });
}
