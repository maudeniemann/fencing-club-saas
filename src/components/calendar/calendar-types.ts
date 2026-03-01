import type { BookingStatus, LessonCategory } from '@/types/database';

export type CalendarView = 'week' | 'month';

export interface CalendarEvent {
  id: string;
  bookingId: string;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  color: string | null;
  coachName: string;
  lessonTypeName: string;
  lessonCategory: LessonCategory;
  durationMinutes: number;
  venueName: string | null;
  participants: Array<{ name: string; status: string }>;
  notes: string | null;
  priceCents: number;
}

export interface LayoutColumn {
  event: CalendarEvent;
  column: number;
  totalColumns: number;
}
