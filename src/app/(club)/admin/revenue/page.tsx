'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MonthlyRevenue {
  month: string;
  revenue_cents: number;
  booking_count: number;
}

interface CoachRevenue {
  coach_id: string;
  coach_name: string;
  revenue_cents: number;
  lesson_count: number;
}

interface RevenueData {
  monthly_revenue: MonthlyRevenue[];
  coach_revenue: CoachRevenue[];
}

export default function RevenuePage() {
  const { club } = useClub();

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue', club?.id],
    queryFn: async () => {
      if (!club) return null;
      const res = await fetch('/api/analytics/revenue');
      if (!res.ok) throw new Error('Failed to fetch revenue data');
      return res.json() as Promise<RevenueData>;
    },
    enabled: !!club,
  });

  // Calculate summary stats from monthly data
  const summary = useMemo(() => {
    if (!revenueData || revenueData.monthly_revenue.length === 0) {
      return {
        totalRevenue: 0,
        totalBookings: 0,
        avgPerBooking: 0,
      };
    }

    const totalRevenue = revenueData.monthly_revenue.reduce(
      (sum, m) => sum + m.revenue_cents,
      0
    );
    const totalBookings = revenueData.monthly_revenue.reduce(
      (sum, m) => sum + m.booking_count,
      0
    );
    const avgPerBooking = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    return { totalRevenue, totalBookings, avgPerBooking };
  }, [revenueData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading revenue data...</p>
      </div>
    );
  }

  if (
    !revenueData ||
    revenueData.monthly_revenue.every((m) => m.revenue_cents === 0 && m.booking_count === 0)
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Revenue</h1>
          <p className="text-muted-foreground">
            View your club revenue analytics.
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No revenue data yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground">
          View your club revenue analytics and monthly breakdown.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">
              ${(summary.totalRevenue / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bookings</CardDescription>
            <CardTitle className="text-3xl">
              {summary.totalBookings}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Per Booking</CardDescription>
            <CardTitle className="text-3xl">
              ${(summary.avgPerBooking / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Separator />

      {/* Monthly Breakdown */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Monthly Breakdown</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueData.monthly_revenue.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">
                      ${(row.revenue_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.booking_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Coach Revenue (Current Month) */}
      {revenueData.coach_revenue.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Coach Revenue (Current Month)
            </h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coach</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Lessons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueData.coach_revenue.map((coach) => (
                      <TableRow key={coach.coach_id}>
                        <TableCell className="font-medium">
                          {coach.coach_name}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ${(coach.revenue_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {coach.lesson_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
