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
import { InstantBookingDialog } from '@/components/booking/instant-booking-dialog';
import { useClub } from '@/providers/club-provider';
import type { ComputedSlot } from '@/types';

interface SlotForBooking {
  date: string;
  start_time: string;
  end_time: string;
  coach_member_id: string;
  venue_id: string | null;
}

export default function CoachAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coachId } = use(params);
  const { role } = useClub();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date().getDay(); // 0=Sun
    return today;
  });
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotForBooking | null>(null);
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

  // Fetch subdivided 30-min slots
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['available-slots', coachId, weekStart.toISOString()],
    queryFn: async () => {
      const mondayStart = startOfWeek(weekStart, { weekStartsOn: 1 });
      const res = await fetch(
        `/api/coaches/${coachId}/available-slots?week_start=${format(mondayStart, 'yyyy-MM-dd')}`
      );
      if (!res.ok) return [];
      return (await res.json()) as ComputedSlot[];
    },
  });

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = new Map<string, ComputedSlot[]>();
    for (const slot of slots) {
      const existing = map.get(slot.date) || [];
      existing.push(slot);
      map.set(slot.date, existing);
    }
    return map;
  }, [slots]);

  // Summary stats
  const { availableCount, bookedCount } = useMemo(() => {
    let available = 0;
    let booked = 0;
    for (const slot of slots) {
      if (slot.is_booked) booked++;
      else available++;
    }
    return { availableCount: available, bookedCount: booked };
  }, [slots]);

  // Auto-scroll to 8 AM on mount / week change
  useEffect(() => {
    if (scrollRef.current) {
      const eightAM = (8 - START_HOUR) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = eightAM - 20;
    }
  }, [currentWeekOffset]);

  const handleSlotClick = (slot: ComputedSlot) => {
    if (slot.is_booked) return;
    if (role !== 'player') return;
    setSelectedSlot({
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      coach_member_id: slot.coach_member_id,
      venue_id: slot.venue_id,
    });
    setBookingDialogOpen(true);
  };

  const isPlayer = role === 'player';

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
          {isPlayer
            ? 'Tap an available slot to book a lesson'
            : 'View available time slots'}
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

      {/* Mobile Day Picker */}
      <div className="md:hidden flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSelectedDayIndex((prev) => Math.max(0, prev - 1))}
          disabled={selectedDayIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 gap-1">
          {daysInWeek.map((day, idx) => {
            const today = isToday(day);
            return (
              <button
                key={idx}
                onClick={() => setSelectedDayIndex(idx)}
                className={cn(
                  'flex-1 flex flex-col items-center py-1 rounded-md text-xs transition-colors',
                  idx === selectedDayIndex
                    ? 'bg-primary text-primary-foreground'
                    : today
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="font-medium">{format(day, 'EEE')}</span>
                <span className="text-[11px]">{format(day, 'd')}</span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSelectedDayIndex((prev) => Math.min(daysInWeek.length - 1, prev + 1))}
          disabled={selectedDayIndex === daysInWeek.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Time Grid */}
      <div
        ref={scrollRef}
        className="relative overflow-auto rounded-lg border border-border bg-background"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {/* Mobile: single day column */}
        <div className="flex md:hidden">
          <TimeGutter />
          {(() => {
            const day = daysInWeek[selectedDayIndex];
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDay.get(dateStr) || [];
            const today = isToday(day);
            const isPast = isBefore(day, startOfDay(new Date()));

            return (
              <div className={cn('flex-1 min-w-0', isPast && 'opacity-50')}>
                <DayColumnHeader day={day} today={today} />
                <DayColumnGrid
                  daySlots={daySlots}
                  today={today}
                  dateStr={dateStr}
                  isPlayer={isPlayer}
                  onSlotClick={handleSlotClick}
                />
              </div>
            );
          })()}
        </div>

        {/* Desktop: all 7 day columns */}
        <div className="hidden md:flex min-w-[700px]">
          <TimeGutter />
          {daysInWeek.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDay.get(dateStr) || [];
            const today = isToday(day);
            const isPast = isBefore(day, startOfDay(new Date()));

            return (
              <div key={dateStr} className={cn('flex-1 min-w-0', isPast && 'opacity-50')}>
                <DayColumnHeader day={day} today={today} />
                <DayColumnGrid
                  daySlots={daySlots}
                  today={today}
                  dateStr={dateStr}
                  isPlayer={isPlayer}
                  onSlotClick={handleSlotClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Instant Booking Dialog */}
      <InstantBookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        slot={selectedSlot}
        coachName={coach?.display_name || 'Coach'}
      />
    </div>
  );
}

function DayColumnHeader({ day, today }: { day: Date; today: boolean }) {
  return (
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
  );
}

function DayColumnGrid({
  daySlots,
  today,
  dateStr,
  isPlayer,
  onSlotClick,
}: {
  daySlots: ComputedSlot[];
  today: boolean;
  dateStr: string;
  isPlayer: boolean;
  onSlotClick: (slot: ComputedSlot) => void;
}) {
  return (
    <div
      className="relative border-r border-border/50"
      style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
    >
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {today && <CurrentTimeIndicator />}
      {daySlots.map((slot, idx) => {
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
        const top = timeToPixels(startTime);
        const height = Math.max(timeToPixels(endTime) - top, 20);
        const timeLabel = format(startTime, 'h:mm a');
        const canBook = isPlayer && !slot.is_booked;

        return (
          <button
            key={`${slot.date}-${slot.start_time}-${idx}`}
            onClick={() => canBook && onSlotClick(slot)}
            disabled={!canBook}
            className={cn(
              'absolute left-1 right-1 rounded-md border-l-[3px] px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight transition-all text-left',
              slot.is_booked
                ? 'bg-muted border-l-muted-foreground/30 text-muted-foreground cursor-default'
                : canBook
                  ? 'bg-emerald-50 border-l-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:shadow-sm active:scale-[0.98]'
                  : 'bg-emerald-50 border-l-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 cursor-default'
            )}
            style={{ top, height }}
          >
            <div className="font-medium truncate">{timeLabel}</div>
            {slot.is_booked ? (
              <div className="text-[10px] opacity-70">Booked</div>
            ) : canBook ? (
              <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Tap to book</div>
            ) : null}
          </button>
        );
      })}
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
