'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import type { CalendarView } from './calendar-types';

interface CalendarToolbarProps {
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onToday: () => void;
}

export function CalendarToolbar({
  currentDate,
  view,
  onViewChange,
  onNavigateBack,
  onNavigateForward,
  onToday,
}: CalendarToolbarProps) {
  const dateLabel =
    view === 'week'
      ? formatWeekRange(currentDate)
      : format(currentDate, 'MMMM yyyy');

  return (
    <div className="flex items-center justify-between pb-4">
      {/* Left: navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={onToday}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onNavigateBack}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onNavigateForward}
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-2 text-base font-semibold tracking-tight">
          {dateLabel}
        </h2>
      </div>

      {/* Right: view toggle */}
      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
        <button
          onClick={() => onViewChange('week')}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            view === 'week'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Week
        </button>
        <button
          onClick={() => onViewChange('month')}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            view === 'month'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Month
        </button>
      </div>
    </div>
  );
}

function formatWeekRange(date: Date): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 6);

  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

function ChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
