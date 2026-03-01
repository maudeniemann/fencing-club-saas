import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  isSameDay,
  isToday,
  format,
  getHours,
  getMinutes,
} from 'date-fns';
import type { CalendarEvent, CalendarView, LayoutColumn } from './calendar-types';
import type { BookingStatus } from '@/types/database';

export const HOUR_HEIGHT = 60; // px per hour
export const START_HOUR = 6; // 6 AM
export const END_HOUR = 22; // 10 PM
export const TOTAL_HOURS = END_HOUR - START_HOUR;

export function timeToPixels(date: Date): number {
  const hours = getHours(date) - START_HOUR;
  const minutes = getMinutes(date);
  return (hours + minutes / 60) * HOUR_HEIGHT;
}

export function eventHeight(start: Date, end: Date): number {
  return Math.max(timeToPixels(end) - timeToPixels(start), 20);
}

export function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-50 border-emerald-400 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-600 dark:text-emerald-100';
    case 'completed':
      return 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950 dark:border-blue-600 dark:text-blue-100';
    case 'cancelled':
      return 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200';
    case 'no_show':
      return 'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-100';
    case 'disputed':
      return 'bg-purple-50 border-purple-400 text-purple-900 dark:bg-purple-950 dark:border-purple-600 dark:text-purple-100';
    default:
      return 'bg-gray-50 border-gray-300 text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100';
  }
}

export function getStatusDot(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-500';
    case 'completed':
      return 'bg-blue-500';
    case 'cancelled':
      return 'bg-red-400';
    case 'no_show':
      return 'bg-amber-500';
    case 'disputed':
      return 'bg-purple-500';
    default:
      return 'bg-gray-400';
  }
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function getMonthGrid(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function getDateRange(
  date: Date,
  view: CalendarView
): { start: Date; end: Date } {
  if (view === 'week') {
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    };
  }
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  return {
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  };
}

export function groupEventsByDay(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = format(event.start, 'yyyy-MM-dd');
    const existing = groups.get(key) || [];
    existing.push(event);
    groups.set(key, existing);
  }
  return groups;
}

export function layoutOverlappingEvents(
  events: CalendarEvent[]
): LayoutColumn[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const columns: Array<{ end: Date; event: CalendarEvent }[]> = [];

  for (const event of sorted) {
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      if (lastInCol.end <= event.start) {
        columns[col].push({ end: event.end, event });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end: event.end, event }]);
    }
  }

  const totalColumns = columns.length;
  const result: LayoutColumn[] = [];

  for (let col = 0; col < columns.length; col++) {
    for (const entry of columns[col]) {
      result.push({
        event: entry.event,
        column: col,
        totalColumns,
      });
    }
  }

  return result;
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

export function formatStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'no_show':
      return 'No Show';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export { isSameDay, isToday, format };
