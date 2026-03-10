'use client';

import { useClub } from '@/providers/club-provider';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleGate } from '@/components/layout/role-gate';
import { format } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();

  // Upcoming bookings via API route
  const { data: upcomingBookings = [] } = useQuery({
    queryKey: ['dashboard-bookings', currentMember?.id, role],
    queryFn: async () => {
      if (!currentMember || !club) return [];
      const now = new Date().toISOString();
      const params = new URLSearchParams({
        club_id: club.id,
        status: 'confirmed',
        start_after: now,
      });
      if (role === 'coach') params.set('coach_id', currentMember.id);
      const res = await fetch(`/api/bookings?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).slice(0, 5);
    },
    enabled: !!currentMember && !!club,
  });

  // Admin: quick stats via API routes
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', club?.id],
    queryFn: async () => {
      if (!club) return null;
      const [membersRes, revenueRes] = await Promise.all([
        fetch('/api/members').then(r => r.ok ? r.json() : []),
        fetch('/api/analytics/revenue').then(r => r.ok ? r.json() : null) as Promise<{ monthly_revenue?: { revenue_cents: number }[] } | null>,
      ]);
      const members = Array.isArray(membersRes) ? membersRes : [];
      const currentMonthRevenue = revenueRes?.monthly_revenue?.length
        ? revenueRes.monthly_revenue[revenueRes.monthly_revenue.length - 1]?.revenue_cents || 0
        : 0;
      return {
        totalMembers: members.length,
        upcomingBookings: 0,
        monthlyRevenue: currentMonthRevenue,
      };
    },
    enabled: !!club && role === 'admin',
  });

  if (clubLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{currentMember?.display_name ? `, ${currentMember.display_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground">
          {club?.name} — {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Admin stats */}
      <RoleGate allowedRoles={['admin']}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Members</CardDescription>
              <CardTitle className="text-3xl">{stats?.totalMembers ?? '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Bookings</CardDescription>
              <CardTitle className="text-3xl">{stats?.upcomingBookings ?? '—'}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Revenue This Month</CardDescription>
              <CardTitle className="text-3xl">
                {stats?.monthlyRevenue != null
                  ? `$${(stats.monthlyRevenue / 100).toFixed(2)}`
                  : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </RoleGate>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <RoleGate allowedRoles={['player']}>
          <Link href="/coaches">
            <Button>Book a Lesson</Button>
          </Link>
        </RoleGate>
        <RoleGate allowedRoles={['coach']}>
          <Link href="/availability">
            <Button>Manage Availability</Button>
          </Link>
        </RoleGate>
        <RoleGate allowedRoles={['admin']}>
          <Link href="/admin/members">
            <Button variant="outline">Manage Members</Button>
          </Link>
        </RoleGate>
        <Link href="/schedule">
          <Button variant="outline">View Schedule</Button>
        </Link>
      </div>

      {/* Upcoming bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Lessons</CardTitle>
          <CardDescription>
            {role === 'coach' ? 'Your next teaching sessions' : 'Your scheduled lessons'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No upcoming lessons.{' '}
              {role === 'player' && (
                <Link href="/coaches" className="text-primary underline">
                  Book one now
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking: Record<string, unknown>) => {
                const b = role === 'coach' ? booking : (booking as Record<string, unknown>).bookings;
                if (!b) return null;
                const bk = b as Record<string, unknown>;
                const lt = bk.lesson_types as Record<string, unknown> | null;
                return (
                  <Link
                    key={booking.id as string}
                    href={`/bookings/${bk.id}`}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">
                        {lt?.name as string || 'Lesson'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(bk.starts_at as string), 'MMM d, h:mm a')} — {lt?.duration_minutes as number}min
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {lt?.category as string}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
