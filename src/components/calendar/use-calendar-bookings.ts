'use client';

import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/providers/club-provider';
import { parseISO } from 'date-fns';
import type { CalendarEvent } from './calendar-types';

export function useCalendarBookings(dateRange: { start: Date; end: Date }) {
  const { club, currentMember, role } = useClub();

  const rangeStart = dateRange.start.toISOString();
  const rangeEnd = dateRange.end.toISOString();

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendar-bookings', currentMember?.id, role, rangeStart, rangeEnd],
    queryFn: async () => {
      if (!currentMember || !club) return [];

      const params = new URLSearchParams({
        club_id: club.id,
        start_after: rangeStart,
        start_before: rangeEnd,
      });

      if (role === 'coach') {
        params.set('coach_id', currentMember.id);
      }

      const res = await fetch(`/api/bookings?${params.toString()}`);
      if (!res.ok) return [];

      const data = await res.json();
      return (data || []).map(normalizeBooking);
    },
    enabled: !!currentMember && !!club,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

function normalizeBooking(b: Record<string, unknown>): CalendarEvent {
  const lt = b.lesson_types as Record<string, unknown> | null;
  const coach = b.coach as Record<string, unknown> | null;
  const venue = b.venue as Record<string, unknown> | null;
  const participants = (b.booking_participants as Record<string, unknown>[]) || [];

  return {
    id: b.id as string,
    bookingId: b.id as string,
    title: (lt?.name as string) || 'Lesson',
    start: parseISO(b.starts_at as string),
    end: parseISO(b.ends_at as string),
    status: b.status as CalendarEvent['status'],
    color: (lt?.color as string) || null,
    coachName: (coach?.display_name as string) || 'Coach',
    lessonTypeName: (lt?.name as string) || 'Lesson',
    lessonCategory: (lt?.category as CalendarEvent['lessonCategory']) || 'private',
    durationMinutes: (lt?.duration_minutes as number) || (b.duration_minutes as number) || 60,
    venueName: (venue?.name as string) || null,
    participants: participants.map((p) => {
      const player = p.player as Record<string, unknown> | null;
      return {
        name: (player?.display_name as string) || 'Unknown',
        status: (p.status as string) || 'confirmed',
      };
    }),
    notes: (b.notes as string) || null,
    priceCents: (lt?.price_cents as number) || 0,
  };
}
