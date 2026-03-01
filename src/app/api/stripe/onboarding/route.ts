import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createConnectedAccount, createAccountLink } from '@/lib/stripe/connect';

export async function POST() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { data: club } = await admin
    .from('clubs')
    .select('*')
    .eq('id', member.club_id)
    .single();

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Create Stripe connected account if not exists
  let stripeAccountId = club.stripe_account_id;
  if (!stripeAccountId) {
    const account = await createConnectedAccount(club.name, club.id);
    stripeAccountId = account.id;

    await admin.from('clubs').update({
      stripe_account_id: stripeAccountId,
    }).eq('id', club.id);
  }

  // Create account link for onboarding
  const accountLink = await createAccountLink(
    stripeAccountId,
    `${baseUrl}/admin/settings?stripe_refresh=true`,
    `${baseUrl}/admin/settings?stripe_onboarding=complete`
  );

  return NextResponse.json({ url: accountLink.url });
}
