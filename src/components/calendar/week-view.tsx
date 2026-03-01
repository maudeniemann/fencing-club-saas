'use client';

import { useEffect, useRef } from 'react';
import { format, isSameDay } from 'date-fns';
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

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollTo = timeToPixels(now) - 200;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="flex" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT + 60 }}>
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
