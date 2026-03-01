import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSetupIntent, createStripeCustomer } from '@/lib/stripe/connect';

export async function POST() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  // Create Stripe customer if not exists
  let customerId = member.stripe_customer_id;
  if (!customerId) {
    const customer = await createStripeCustomer(
      user.email || '',
      member.display_name || '',
      member.id
    );
    customerId = customer.id;

    await admin.from('club_members').update({
      stripe_customer_id: customerId,
    }).eq('id', member.id);
  }

  const setupIntent = await createSetupIntent(customerId);

  return NextResponse.json({
    client_secret: setupIntent.client_secret,
    customer_id: customerId,
  });
}
