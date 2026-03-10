import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';

export async function GET(request: NextRequest) {
  const { member } = await getDemoSafeClient();
  const admin = createAdminClient();

  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const coachId = searchParams.get('coach_id');
  const periodStart = searchParams.get('period_start');
  const periodEnd = searchParams.get('period_end');

  if (!coachId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Get coach info
  const { data: coach } = await admin
    .from('club_members')
    .select('id, display_name, commission_rate')
    .eq('id', coachId)
    .single();

  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 });

  const { data: club } = await admin
    .from('clubs')
    .select('default_commission_split')
    .eq('id', member.club_id)
    .single();

  const commissionRate = coach.commission_rate || club?.default_commission_split || 70;

  // Get completed bookings in period
  const { data: bookings } = await admin
    .from('bookings')
    .select('id, booking_number, starts_at, duration_minutes, status, lesson_types(name, price_cents)')
    .eq('coach_member_id', coachId)
    .eq('club_id', member.club_id)
    .in('status', ['completed', 'no_show'])
    .gte('starts_at', `${periodStart}T00:00:00`)
    .lte('starts_at', `${periodEnd}T23:59:59`)
    .order('starts_at', { ascending: true });

  const bookingIds = (bookings || []).map((b) => b.id);

  let totalRevenue = 0;
  if (bookingIds.length > 0) {
    const { data: payments } = await admin
      .from('payments')
      .select('club_amount_cents')
      .in('booking_id', bookingIds)
      .eq('status', 'succeeded')
      .eq('payment_type', 'lesson');

    totalRevenue = (payments || []).reduce((sum, p) => sum + (p.club_amount_cents || 0), 0);
  }

  const coachAmount = Math.round(totalRevenue * commissionRate / 100);

  return NextResponse.json({
    coach_member_id: coachId,
    coach_name: coach.display_name,
    period_start: periodStart,
    period_end: periodEnd,
    total_lessons: bookings?.length || 0,
    total_revenue_cents: totalRevenue,
    commission_rate: commissionRate,
    coach_amount_cents: coachAmount,
    club_retained_cents: totalRevenue - coachAmount,
    bookings: bookings || [],
  });
}
