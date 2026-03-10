'use client';

import { useEffect, useRef, useState } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { CalendarEvent } from './calendar-types';
import {
  HOUR_HEIGHT,
  START_HOUR,
  TOTAL_HOURS,
  getWeekDays,
  groupEventsByDay,
  timeToPixels,
} from './calendar-utils';
import { TimeGutter } from './time-gutter';
import { DayColumn } from './day-column';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  showCoach?: boolean;
}

export function WeekView({
  currentDate,
  events,
  onEventClick,
  showCoach,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = getWeekDays(currentDate);
  const eventsByDay = groupEventsByDay(events);

  // Default to today's index within the week, or 0 if today is not in the week
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const todayIdx = days.findIndex((d) => isToday(d));
    return todayIdx >= 0 ? todayIdx : 0;
  });

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = timeToPixels(now) - 200;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, []);

  const selectedDay = days[selectedDayIndex];
  const selectedKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedDayEvents = eventsByDay.get(selectedKey) || [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile Day Picker */}
      <div className="md:hidden flex items-center gap-1 px-2 py-1.5 border-b border-border/50">
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
          {days.map((day, idx) => {
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
          onClick={() => setSelectedDayIndex((prev) => Math.min(days.length - 1, prev + 1))}
          disabled={selectedDayIndex === days.length - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Mobile: single day column */}
        <div className="flex md:hidden" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT + 60 }}>
          <TimeGutter />
          <div className="flex flex-1">
            <DayColumn
              key={selectedKey}
              date={selectedDay}
              events={selectedDayEvents}
              onEventClick={onEventClick}
              showCoach={showCoach}
            />
          </div>
        </div>

        {/* Desktop: all 7 day columns */}
        <div className="hidden md:flex" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT + 60 }}>
          <TimeGutter />
          <div className="flex flex-1">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) || [];
              return (
                <DayColumn
                  key={key}
                  date={day}
                  events={dayEvents}
                  onEventClick={onEventClick}
                  showCoach={showCoach}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
