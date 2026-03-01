'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import { format, startOfMonth } from 'date-fns';
import type { Payment } from '@/types';

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

export default function RevenuePage() {
  const { club } = useClub();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', club?.id],
    queryFn: async () => {
      if (!club) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('club_id', club.id)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!club,
  });

  // Calculate summary stats
  const summary = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        totalRevenue: 0,
        platformFees: 0,
        netRevenue: 0,
        avgPerBooking: 0,
      };
    }

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const platformFees = payments.reduce(
      (sum, p) => sum + p.platform_fee_cents,
      0
    );
    const netRevenue = payments.reduce(
      (sum, p) => sum + p.club_amount_cents,
      0
    );
    const avgPerBooking = totalRevenue / payments.length;

    return { totalRevenue, platformFees, netRevenue, avgPerBooking };
  }, [payments]);

  // Calculate monthly breakdown
  const monthlyData = useMemo(() => {
    if (!payments || payments.length === 0) return [];

    const grouped = new Map<
      string,
      {
        month: string;
        revenue: number;
        fees: number;
        net: number;
        count: number;
      }
    >();

    for (const payment of payments) {
      const monthKey = format(
        startOfMonth(new Date(payment.created_at)),
        'yyyy-MM'
      );
      const monthLabel = format(
        startOfMonth(new Date(payment.created_at)),
        'MMMM yyyy'
      );

      const existing = grouped.get(monthKey) ?? {
        month: monthLabel,
        revenue: 0,
        fees: 0,
        net: 0,
        count: 0,
      };

      existing.revenue += payment.amount_cents;
      existing.fees += payment.platform_fee_cents;
      existing.net += payment.club_amount_cents;
      existing.count += 1;

      grouped.set(monthKey, existing);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, data]) => data);
  }, [payments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading revenue data...</p>
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
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
        <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground">
          View your club revenue analytics and monthly breakdown.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardDescription>Platform Fees</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              ${(summary.platformFees / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Revenue</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              ${(summary.netRevenue / 100).toFixed(2)}
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
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">
                      ${(row.revenue / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${(row.fees / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${(row.net / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
