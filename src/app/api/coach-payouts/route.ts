import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { z } from 'zod';

const createPayoutSchema = z.object({
  coach_member_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payout_method: z.enum(['manual', 'stripe_transfer', 'bank_transfer']).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data } = await client
    .from('coach_payouts')
    .select('*, coach:club_members!coach_payouts_coach_member_id_fkey(display_name)')
    .eq('club_id', member.club_id)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { user, member, client } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createPayoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Get coach commission rate
  const { data: coach } = await client
    .from('club_members')
    .select('commission_rate')
    .eq('id', parsed.data.coach_member_id)
    .single();

  const { data: club } = await client
    .from('clubs')
    .select('default_commission_split')
    .eq('id', member.club_id)
    .single();

  const commissionRate = coach?.commission_rate || club?.default_commission_split || 70;

  // Calculate total lesson revenue for the period
  const { data: bookings } = await client
    .from('bookings')
    .select('id')
    .eq('coach_member_id', parsed.data.coach_member_id)
    .eq('club_id', member.club_id)
    .in('status', ['completed', 'no_show'])
    .gte('starts_at', `${parsed.data.period_start}T00:00:00`)
    .lte('starts_at', `${parsed.data.period_end}T23:59:59`);

  const bookingIds = (bookings || []).map((b) => b.id);

  let totalRevenue = 0;
  if (bookingIds.length > 0) {
    const { data: payments } = await client
      .from('payments')
      .select('club_amount_cents')
      .in('booking_id', bookingIds)
      .eq('status', 'succeeded')
      .eq('payment_type', 'lesson');

    totalRevenue = (payments || []).reduce((sum, p) => sum + (p.club_amount_cents || 0), 0);
  }

  const coachPayoutCents = Math.round(totalRevenue * commissionRate / 100);
  const clubRetainedCents = totalRevenue - coachPayoutCents;

  const { data: payout, error } = await client
    .from('coach_payouts')
    .insert({
      club_id: member.club_id,
      coach_member_id: parsed.data.coach_member_id,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      total_lesson_revenue_cents: totalRevenue,
      commission_rate: commissionRate,
      coach_payout_cents: coachPayoutCents,
      club_retained_cents: clubRetainedCents,
      payout_method: parsed.data.payout_method || 'manual',
      notes: parsed.data.notes || null,
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(payout, { status: 201 });
}
