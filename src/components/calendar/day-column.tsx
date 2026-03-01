'use client';

import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import type { CalendarEvent } from './calendar-types';
import {
  HOUR_HEIGHT,
  START_HOUR,
  TOTAL_HOURS,
  timeToPixels,
  eventHeight,
  layoutOverlappingEvents,
} from './calendar-utils';
import { CalendarEventBlock } from './calendar-event';

interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  showCoach?: boolean;
}

export function DayColumn({ date, events, onEventClick, showCoach }: DayColumnProps) {
  const today = isToday(date);
  const laid = layoutOverlappingEvents(events);

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div
        className={cn(
          'sticky top-0 z-20 flex flex-col items-center py-1.5 border-b border-r border-border/50 bg-background/95 backdrop-blur-sm',
          today && 'bg-primary/5'
        )}
      >
        <span className="text-[11px] font-medium text-muted-foreground uppercase">
          {format(date, 'EEE')}
        </span>
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
            today
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground'
          )}
        >
          {format(date, 'd')}
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

        {/* Events */}
        {laid.map(({ event, column, totalColumns }) => {
          const top = timeToPixels(event.start);
          const height = eventHeight(event.start, event.end);
          const width = `${100 / totalColumns}%`;
          const left = `${(column / totalColumns) * 100}%`;

          return (
            <CalendarEventBlock
              key={event.id}
              event={event}
              onClick={onEventClick}
              showCoach={showCoach}
              style={{
                top,
                height,
                width,
                left,
                position: 'absolute',
              }}
            />
          );
        })}
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
