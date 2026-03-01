'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useClub } from '@/providers/club-provider';
import { parseISO } from 'date-fns';
import type { CalendarEvent } from './calendar-types';

const BOOKING_SELECT =
  '*, lesson_types(name, category, duration_minutes, price_cents, color), booking_participants(*, player:club_members!booking_participants_player_member_id_fkey(display_name, id)), coach:club_members!bookings_coach_member_id_fkey(display_name), venue:venues(name)';

export function useCalendarBookings(dateRange: { start: Date; end: Date }) {
  const { club, currentMember, role } = useClub();
  const supabase = createClient();

  const rangeStart = dateRange.start.toISOString();
  const rangeEnd = dateRange.end.toISOString();

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendar-bookings', currentMember?.id, role, rangeStart, rangeEnd],
    queryFn: async () => {
      if (!currentMember || !club) return [];

      if (role === 'admin') {
        const { data } = await supabase
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('club_id', club.id)
          .gte('starts_at', rangeStart)
          .lte('starts_at', rangeEnd)
          .order('starts_at', { ascending: true });
        return (data || []).map(normalizeBooking);
      }

      if (role === 'coach') {
        const { data } = await supabase
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('coach_member_id', currentMember.id)
          .gte('starts_at', rangeStart)
          .lte('starts_at', rangeEnd)
          .order('starts_at', { ascending: true });
        return (data || []).map(normalizeBooking);
      }

      // Player/parent: fetch via booking_participants
      const { data } = await supabase
        .from('booking_participants')
        .select(
          `*, bookings:booking_id(${BOOKING_SELECT})`
        )
        .eq('player_member_id', currentMember.id);

      if (!data) return [];

      return (data as Record<string, unknown>[])
        .map((bp) => {
          const b = bp.bookings as Record<string, unknown> | null;
          if (!b) return null;
          const startsAt = b.starts_at as string;
          if (startsAt < rangeStart || startsAt > rangeEnd) return null;
          return normalizeBooking(b);
        })
        .filter(Boolean) as CalendarEvent[];
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
