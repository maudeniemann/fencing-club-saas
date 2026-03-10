'use client';

import { useClub } from '@/providers/club-provider';
import { useQuery } from '@tanstack/react-query';
import { RoleGate } from '@/components/layout/role-gate';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { EarningsForecast } from '@/types';

export default function EarningsPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();

  // Fetch completed bookings with payments
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['coach-earnings-bookings', currentMember?.id],
    queryFn: async () => {
      if (!currentMember || !club) return [];

      const params = new URLSearchParams({
        coach_id: currentMember.id,
        club_id: club.id,
      });
      const res = await fetch(`/api/bookings?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      // Filter to completed/confirmed/no_show on client side
      // (the API returns all statuses when no status filter is provided)
      return data.filter((b: Record<string, unknown>) =>
        ['completed', 'confirmed', 'no_show'].includes(b.status as string)
      );
    },
    enabled: !!currentMember && !!club && role === 'coach',
  });

  // Fetch earnings forecast
  const { data: forecast } = useQuery({
    queryKey: ['earnings-forecast', currentMember?.id],
    queryFn: async () => {
      const response = await fetch('/api/analytics/earnings-forecast');
      if (!response.ok) return null;
      return (await response.json()) as EarningsForecast;
    },
    enabled: !!currentMember && role === 'coach',
  });

  // Calculate stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalRevenueCents = bookings.reduce((sum: number, b: Record<string, unknown>) => {
    const participants = (b.booking_participants || []) as Array<Record<string, unknown>>;
    return sum + participants.reduce((pSum: number, p: Record<string, unknown>) => {
      return pSum + ((p.price_charged_cents as number) || 0);
    }, 0);
  }, 0);

  const lessonsThisMonth = bookings.filter((b: Record<string, unknown>) => {
    const startsAt = new Date(b.starts_at as string);
    return startsAt >= startOfMonth;
  }).length;

  const totalLessons = bookings.length;
  const avgPerLesson = totalLessons > 0 ? totalRevenueCents / totalLessons : 0;
  const fillRate = forecast?.average_fill_rate ?? 0;

  if (clubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <RoleGate allowedRoles={['coach']} fallback={<div className="p-8 text-center text-muted-foreground">Access restricted to coaches.</div>}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Earnings</h1>
          <p className="text-muted-foreground">
            Track your income and lesson statistics.
          </p>
        </div>

        {/* Summary cards */}
        {bookingsLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading earnings data...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Earned</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    ${(totalRevenueCents / 100).toFixed(2)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Lessons This Month</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">{lessonsThisMonth}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Per Lesson</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    ${(avgPerLesson / 100).toFixed(2)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Fill Rate</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl">
                    {(fillRate * 100).toFixed(0)}%
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Forecast section */}
            {forecast && (
              <Card>
                <CardHeader>
                  <CardTitle>Projected Earnings</CardTitle>
                  <CardDescription>
                    Based on your current bookings and trends.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">This Month (Projected)</div>
                      <div className="text-xl font-semibold">
                        ${(forecast.current_month_projected / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Next Month (Projected)</div>
                      <div className="text-xl font-semibold">
                        ${(forecast.next_month_projected / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Upcoming Confirmed</div>
                      <div className="text-xl font-semibold">
                        ${(forecast.upcoming_confirmed_revenue / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Recent completed lessons */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Lessons</CardTitle>
                <CardDescription>
                  Completed and confirmed lessons with payment details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No lessons yet. Once you start teaching, your earnings will appear here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 20).map((booking: Record<string, unknown>) => {
                      const lessonType = booking.lesson_types as Record<string, unknown> | null;
                      const participants = (booking.booking_participants || []) as Array<Record<string, unknown>>;
                      const paymentTotal = participants.reduce((sum: number, p: Record<string, unknown>) => {
                        return sum + ((p.price_charged_cents as number) || 0);
                      }, 0);

                      return (
                        <div
                          key={booking.id as string}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div>
                            <div className="font-medium">
                              {(lessonType?.name as string) || 'Lesson'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(booking.starts_at as string), 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                booking.status === 'completed'
                                  ? 'default'
                                  : booking.status === 'no_show'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {booking.status as string}
                            </Badge>
                            <span className="font-semibold">
                              ${(paymentTotal / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleGate>
  );
}
