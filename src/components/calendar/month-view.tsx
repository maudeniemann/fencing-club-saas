'use client';

import { cn } from '@/lib/utils';
import { format, isSameMonth, isToday, isSameDay, startOfWeek, addDays } from 'date-fns';
import type { CalendarEvent } from './calendar-types';
import { getMonthGrid, groupEventsByDay, getStatusDot } from './calendar-utils';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: MonthViewProps) {
  const days = getMonthGrid(currentDate);
  const eventsByDay = groupEventsByDay(events);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex flex-col items-start border-b border-r border-border/30 p-1.5 text-left transition-colors hover:bg-accent/30 min-h-[80px]',
                !inMonth && 'opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-0.5',
                  today
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground'
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Event pills */}
              <div className="w-full space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={cn(
                      'flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate cursor-pointer hover:bg-accent/50 transition-colors',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                        event.color ? '' : getStatusDot(event.status)
                      )}
                      style={event.color ? { backgroundColor: event.color } : {}}
                    />
                    <span className="truncate">
                      {format(event.start, 'h:mm')} {event.title}
                    </span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
