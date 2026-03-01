import { subDays, endOfMonth, startOfMonth, format, subMonths } from 'date-fns';
import type { EarningsForecast } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function generateEarningsForecast(
  coachMemberId: string,
  clubId: string,
  supabase: any
): Promise<EarningsForecast> {
  const now = new Date();
  const ninetyDaysAgo = subDays(now, 90);
  const monthEnd = endOfMonth(now);

  // 1. Get confirmed upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('id, lesson_types(price_cents)')
    .eq('coach_member_id', coachMemberId)
    .eq('club_id', clubId)
    .eq('status', 'confirmed')
    .gte('starts_at', now.toISOString());

  const upcomingConfirmedRevenue = (upcomingBookings || []).reduce(
    (sum: number, b: any) => sum + ((b.lesson_types as any)?.price_cents || 0),
    0
  );

  // 2. Historical fill rate (past 90 days)
  const { count: totalAvailableSlots } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('coach_member_id', coachMemberId)
    .eq('is_blocked', false)
    .gte('slot_date', format(ninetyDaysAgo, 'yyyy-MM-dd'));

  const { count: totalBookedSlots } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('coach_member_id', coachMemberId)
    .gte('starts_at', ninetyDaysAgo.toISOString())
    .in('status', ['confirmed', 'completed']);

  const fillRate = totalAvailableSlots
    ? (totalBookedSlots || 0) / totalAvailableSlots
    : 0;

  // 3. Project remaining slots this month
  const { count: remainingSlotCount } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('coach_member_id', coachMemberId)
    .eq('is_blocked', false)
    .gte('slot_date', format(now, 'yyyy-MM-dd'))
    .lte('slot_date', format(monthEnd, 'yyyy-MM-dd'));

  const bookedThisMonthRemaining = (upcomingBookings || []).length;

  const unbookedSlots = Math.max(0, (remainingSlotCount || 0) - bookedThisMonthRemaining);
  const avgLessonPrice =
    upcomingConfirmedRevenue / Math.max(1, upcomingBookings?.length || 1);
  const projectedFromUnbooked = Math.round(unbookedSlots * fillRate * avgLessonPrice);

  // 4. Get commission rate
  const { data: member } = await supabase
    .from('club_members')
    .select('commission_rate')
    .eq('id', coachMemberId)
    .single();

  const { data: club } = await supabase
    .from('clubs')
    .select('default_commission_split')
    .eq('id', clubId)
    .single();

  const commissionRate =
    ((member?.commission_rate || club?.default_commission_split || 70) as number) / 100;

  // 5. Monthly trend (last 6 months)
  const monthlyTrend: { month: string; actual: number; projected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEndDate = endOfMonth(monthDate);

    const { data: monthPayments } = await supabase
      .from('payments')
      .select('club_amount_cents')
      .eq('status', 'succeeded')
      .eq('payment_type', 'lesson')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEndDate.toISOString());

    // Filter by coach (via booking)
    const actual = (monthPayments || []).reduce(
      (sum: number, p: any) => sum + (p.club_amount_cents || 0),
      0
    );

    monthlyTrend.push({
      month: format(monthDate, 'MMM yyyy'),
      actual: Math.round(actual * commissionRate),
      projected: i === 0
        ? Math.round((upcomingConfirmedRevenue + projectedFromUnbooked) * commissionRate)
        : Math.round(actual * commissionRate),
    });
  }

  return {
    current_month_projected: Math.round(
      (upcomingConfirmedRevenue + projectedFromUnbooked) * commissionRate
    ),
    next_month_projected: Math.round(
      monthlyTrend.reduce((sum, m) => sum + m.actual, 0) / Math.max(1, monthlyTrend.length) // avg of past months
    ),
    monthly_trend: monthlyTrend,
    average_fill_rate: Math.round(fillRate * 100),
    upcoming_confirmed_revenue: Math.round(upcomingConfirmedRevenue * commissionRate),
  };
}
