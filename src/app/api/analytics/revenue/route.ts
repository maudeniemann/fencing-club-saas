import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client: admin } = auth;

  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '6', 10);

  // Revenue per month
  const now = new Date();
  const monthlyRevenue: Array<{ month: string; revenue_cents: number; booking_count: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    const { data: payments } = await admin
      .from('payments')
      .select('club_amount_cents')
      .eq('club_id', member.club_id)
      .eq('status', 'succeeded')
      .eq('payment_type', 'lesson')
      .gte('created_at', mStart.toISOString())
      .lte('created_at', mEnd.toISOString());

    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', member.club_id)
      .in('status', ['completed', 'confirmed'])
      .gte('starts_at', mStart.toISOString())
      .lte('starts_at', mEnd.toISOString());

    monthlyRevenue.push({
      month: format(monthDate, 'MMM yyyy'),
      revenue_cents: (payments || []).reduce((sum, p) => sum + (p.club_amount_cents || 0), 0),
      booking_count: count || 0,
    });
  }

  // Revenue per coach (current month)
  const currentMonthStart = startOfMonth(now);
  const { data: coaches } = await admin
    .from('club_members')
    .select('id, display_name')
    .eq('club_id', member.club_id)
    .eq('role', 'coach')
    .eq('is_active', true);

  const coachRevenue: Array<{
    coach_id: string;
    coach_name: string;
    revenue_cents: number;
    lesson_count: number;
  }> = [];

  for (const coach of coaches || []) {
    const { data: coachBookings } = await admin
      .from('bookings')
      .select('id')
      .eq('coach_member_id', coach.id)
      .eq('club_id', member.club_id)
      .in('status', ['completed', 'confirmed'])
      .gte('starts_at', currentMonthStart.toISOString());

    const bookingIds = (coachBookings || []).map((b) => b.id);
    let revenue = 0;

    if (bookingIds.length > 0) {
      const { data: payments } = await admin
        .from('payments')
        .select('club_amount_cents')
        .in('booking_id', bookingIds)
        .eq('status', 'succeeded');

      revenue = (payments || []).reduce((sum, p) => sum + (p.club_amount_cents || 0), 0);
    }

    coachRevenue.push({
      coach_id: coach.id,
      coach_name: coach.display_name || 'Unknown',
      revenue_cents: revenue,
      lesson_count: bookingIds.length,
    });
  }

  return NextResponse.json({
    monthly_revenue: monthlyRevenue,
    coach_revenue: coachRevenue.sort((a, b) => b.revenue_cents - a.revenue_cents),
  });
}
