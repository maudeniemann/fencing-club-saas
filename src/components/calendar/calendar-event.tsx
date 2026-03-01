'use client';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { CalendarEvent } from './calendar-types';
import { getStatusColor } from './calendar-utils';

interface CalendarEventBlockProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  onClick: (event: CalendarEvent) => void;
  showCoach?: boolean;
}

export function CalendarEventBlock({
  event,
  style,
  onClick,
  showCoach = false,
}: CalendarEventBlockProps) {
  const heightPx = parseFloat(String(style.height)) || 0;
  const isCompact = heightPx < 40;

  return (
    <button
      onClick={() => onClick(event)}
      className={cn(
        'absolute rounded-md border-l-[3px] px-1.5 py-0.5 text-left transition-shadow hover:shadow-md hover:z-10 overflow-hidden cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        event.color ? '' : getStatusColor(event.status)
      )}
      style={{
        ...style,
        ...(event.color
          ? {
              borderLeftColor: event.color,
              backgroundColor: `${event.color}12`,
              color: 'inherit',
            }
          : {}),
      }}
    >
      {isCompact ? (
        <div className="text-[11px] font-medium leading-tight truncate">
          {format(event.start, 'h:mm')} {event.title}
        </div>
      ) : (
        <>
          <div className="text-[11px] font-medium leading-tight truncate">
            {event.title}
          </div>
          <div className="text-[10px] opacity-70 leading-tight truncate">
            {format(event.start, 'h:mm')}–{format(event.end, 'h:mm a')}
          </div>
          {showCoach && (
            <div className="text-[10px] opacity-60 leading-tight truncate">
              {event.coachName}
            </div>
          )}
        </>
      )}
    </button>
  );
}
