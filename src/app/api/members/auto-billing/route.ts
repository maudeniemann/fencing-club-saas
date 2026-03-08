import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const updateAutoBillingSchema = z.object({
  enabled: z.boolean(),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, role, stripe_customer_id, stripe_default_payment_method_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!member) return NextResponse.json({ error: 'No membership' }, { status: 403 });

  // Only players can use auto-billing
  if (member.role !== 'player') {
    return NextResponse.json({ error: 'Auto-billing is only available for players' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateAutoBillingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { enabled } = parsed.data;

  // If enabling, require payment method
  if (enabled && (!member.stripe_customer_id || !member.stripe_default_payment_method_id)) {
    return NextResponse.json(
      { error: 'Payment method required. Please add a payment method first.' },
      { status: 400 }
    );
  }

  // Update auto_billing_enabled
  const { error } = await admin
    .from('club_members')
    .update({ auto_billing_enabled: enabled })
    .eq('id', member.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enabled });
}
