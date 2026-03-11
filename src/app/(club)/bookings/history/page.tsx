'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  disputed: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export default function BookingHistoryPage() {
  const { club, currentMember, role, isLoading: clubLoading } = useClub();
  const [activeTab, setActiveTab] = useState('all');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings-history', currentMember?.id, role],
    queryFn: async () => {
      if (!currentMember || !club) return [];
      const params = new URLSearchParams({ club_id: club.id });
      if (role === 'coach') params.set('coach_id', currentMember.id);
      const res = await fetch(`/api/bookings?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentMember && !!club,
  });

  if (clubLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading bookings...</div>
      </div>
    );
  }

  // For players, bookings come nested under booking_participants
  const normalizedBookings = bookings.map((b: Record<string, unknown>) => {
    if (role === 'coach') return b;
    // Player bookings may be nested
    const inner = b.bookings as Record<string, unknown> | undefined;
    if (inner) {
      return { ...inner, _participant: b };
    }
    return b;
  });

  const now = new Date().toISOString();

  const filtered = normalizedBookings.filter((b: Record<string, unknown>) => {
    const status = b.status as string;
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') return status === 'confirmed' && (b.starts_at as string) >= now;
    if (activeTab === 'completed') return status === 'completed';
    if (activeTab === 'cancelled') return status === 'cancelled' || status === 'no_show';
    return true;
  });

  const upcomingCount = normalizedBookings.filter(
    (b: Record<string, unknown>) =>
      b.status === 'confirmed' && (b.starts_at as string) >= now
  ).length;
  const completedCount = normalizedBookings.filter(
    (b: Record<string, unknown>) => b.status === 'completed'
  ).length;
  const cancelledCount = normalizedBookings.filter(
    (b: Record<string, unknown>) =>
      b.status === 'cancelled' || b.status === 'no_show'
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="text-muted-foreground">
          {role === 'coach' ? 'Your teaching sessions' : 'Your lesson history'}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({normalizedBookings.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No bookings found.
                {activeTab === 'all' && role === 'player' && (
                  <>
                    {' '}
                    <Link href="/coaches" className="text-primary underline">
                      Book a lesson
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((booking: Record<string, unknown>) => {
                const lt = booking.lesson_types as Record<string, unknown> | null;
                const coach = booking.coach as Record<string, unknown> | null;
                const status = booking.status as string;
                const bookingId = booking.id as string;

                return (
                  <Link
                    key={bookingId}
                    href={`/bookings/${bookingId}`}
                    className="block"
                  >
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {(lt?.name as string) || 'Lesson'}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={statusColors[status] || ''}
                          >
                            {status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <CardDescription>
                          {coach?.display_name
                            ? `Coach: ${coach.display_name as string}`
                            : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-muted-foreground">
                            {format(
                              new Date(booking.starts_at as string),
                              'MMM d, yyyy h:mm a'
                            )}
                            {' · '}
                            {(lt?.duration_minutes as number) || booking.duration_minutes as number} min
                          </div>
                          {lt?.price_cents != null && (
                            <div className="font-medium">
                              ${((lt.price_cents as number) / 100).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
