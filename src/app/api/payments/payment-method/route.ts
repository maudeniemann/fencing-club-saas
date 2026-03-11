import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/client';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, stripe_default_payment_method_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  if (!member.stripe_default_payment_method_id) {
    return NextResponse.json({ payment_method: null });
  }

  try {
    const pm = await stripe.paymentMethods.retrieve(member.stripe_default_payment_method_id);
    return NextResponse.json({
      payment_method: {
        id: pm.id,
        brand: pm.card?.brand || null,
        last4: pm.card?.last4 || null,
        exp_month: pm.card?.exp_month || null,
        exp_year: pm.card?.exp_year || null,
      },
    });
  } catch {
    return NextResponse.json({ payment_method: null });
  }
}
