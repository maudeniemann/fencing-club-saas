'use client';

import { use, useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  addWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parse,
  isToday,
  isWithinInterval,
  isBefore,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TimeGutter } from '@/components/calendar/time-gutter';
import {
  HOUR_HEIGHT,
  START_HOUR,
  TOTAL_HOURS,
  timeToPixels,
} from '@/components/calendar/calendar-utils';

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  slot_date: string | null;
  is_recurring: boolean;
  day_of_week: number | null;
}

interface Booking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

interface ResolvedSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isBooked: boolean;
}

export default function CoachAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coachId } = use(params);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), currentWeekOffset), {
    weekStartsOn: 0,
  });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: coach } = useQuery({
    queryKey: ['coach', coachId],
    queryFn: async () => {
      const res = await fetch(`/api/coaches/${coachId}`);
      if (!res.ok) throw new Error('Failed to fetch coach');
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'coach-availability',
      coachId,
      weekStart.toISOString(),
      weekEnd.toISOString(),
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/coaches/${coachId}/availability?start_date=${format(weekStart, 'yyyy-MM-dd')}&end_date=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      if (!res.ok) throw new Error('Failed to fetch availability');
      return res.json() as Promise<{
        availability_slots: AvailabilitySlot[];
        bookings: Booking[];
      }>;
    },
  });

  // Resolve slots for each day
  const slotsByDay = useMemo(() => {
    const map = new Map<string, ResolvedSlot[]>();

    for (const day of daysInWeek) {
      const dayOfWeek = day.getDay();
      const dateStr = format(day, 'yyyy-MM-dd');
      const slots: ResolvedSlot[] = [];

      // Recurring slots
      data?.availability_slots
        .filter((s) => s.is_recurring && s.day_of_week === dayOfWeek)
        .forEach((slot) => {
          const startTime = parse(
            `${dateStr} ${slot.start_time}`,
            'yyyy-MM-dd HH:mm:ss',
            new Date()
          );
          const endTime = parse(
            `${dateStr} ${slot.end_time}`,
            'yyyy-MM-dd HH:mm:ss',
            new Date()
          );

          const isBooked =
            data?.bookings.some((b) => {
              const bs = new Date(b.starts_at);
              const be = new Date(b.ends_at);
              return (
                isWithinInterval(bs, { start: startTime, end: endTime }) ||
                isWithinInterval(startTime, { start: bs, end: be })
              );
            }) || false;

          slots.push({ id: slot.id, startTime, endTime, isBooked });
        });

      // One-time slots
      data?.availability_slots
        .filter((s) => !s.is_recurring && s.slot_date === dateStr)
        .forEach((slot) => {
          const startTime = parse(
            `${dateStr} ${slot.start_time}`,
            'yyyy-MM-dd HH:mm:ss',
            new Date()
          );
          const endTime = parse(
            `${dateStr} ${slot.end_time}`,
            'yyyy-MM-dd HH:mm:ss',
            new Date()
          );

          const isBooked =
            data?.bookings.some((b) => {
              const bs = new Date(b.starts_at);
              const be = new Date(b.ends_at);
              return (
                isWithinInterval(bs, { start: startTime, end: endTime }) ||
                isWithinInterval(startTime, { start: bs, end: be })
              );
            }) || false;

          slots.push({ id: slot.id, startTime, endTime, isBooked });
        });

      slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      map.set(dateStr, slots);
    }

    return map;
  }, [data, daysInWeek]);

  // Summary stats
  const { availableCount, bookedCount } = useMemo(() => {
    let available = 0;
    let booked = 0;
    slotsByDay.forEach((slots) => {
      slots.forEach((s) => {
        if (s.isBooked) booked++;
        else available++;
      });
    });
    return { availableCount: available, bookedCount: booked };
  }, [slotsByDay]);

  // Auto-scroll to 8 AM on mount / week change
  useEffect(() => {
    if (scrollRef.current) {
      const eightAM = (8 - START_HOUR) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = eightAM - 20;
    }
  }, [currentWeekOffset]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {coach?.display_name || 'Coach'} Availability
        </h1>
        <p className="text-muted-foreground">
          View available time slots for booking
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
          {currentWeekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentWeekOffset(0)}
            >
              Today
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Summary + Legend */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {availableCount} available slot{availableCount !== 1 ? 's' : ''} · {bookedCount} booked this week
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 border border-emerald-400" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-muted border border-muted-foreground/30" />
            Booked
          </span>
        </div>
      </div>

      {/* Time Grid */}
      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-lg border border-border bg-background"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        <div className="flex min-w-[700px]">
          {/* Time gutter */}
          <TimeGutter />

          {/* Day columns */}
          {daysInWeek.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const slots = slotsByDay.get(dateStr) || [];
            const today = isToday(day);
            const isPast = isBefore(day, startOfDay(new Date()));

            return (
              <div key={dateStr} className={cn('flex-1 min-w-0', isPast && 'opacity-50')}>
                {/* Day header */}
                <div
                  className={cn(
                    'sticky top-0 z-20 flex flex-col items-center py-1.5 border-b border-r border-border/50 bg-background/95 backdrop-blur-sm',
                    today && 'bg-primary/5'
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">
                    {format(day, 'EEE')}
                  </span>
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                      today
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Time grid body */}
                <div
                  className="relative border-r border-border/50"
                  style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/30"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {today && <CurrentTimeIndicator />}

                  {/* Availability slot blocks */}
                  {slots.map((slot) => {
                    const top = timeToPixels(slot.startTime);
                    const height = Math.max(
                      timeToPixels(slot.endTime) - top,
                      20
                    );
                    const timeLabel = `${format(slot.startTime, 'h:mm a')} – ${format(slot.endTime, 'h:mm a')}`;

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          'absolute left-1 right-1 rounded-md border-l-[3px] px-1.5 py-1 overflow-hidden text-[11px] leading-tight transition-colors',
                          slot.isBooked
                            ? 'bg-muted border-l-muted-foreground/30 text-muted-foreground'
                            : 'bg-emerald-50 border-l-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                        )}
                        style={{
                          top,
                          height,
                          position: 'absolute',
                        }}
                      >
                        <div className="font-medium truncate">{timeLabel}</div>
                        {slot.isBooked && (
                          <div className="text-[10px] opacity-70 line-through">
                            Booked
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const top = timeToPixels(now);

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  );
}
