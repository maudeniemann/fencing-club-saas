'use client';

import { useState, useCallback } from 'react';
import { useClub } from '@/providers/club-provider';
import type { CalendarEvent } from './calendar-types';
import { useCalendarNavigation } from './use-calendar-navigation';
import { useCalendarBookings } from './use-calendar-bookings';
import { CalendarToolbar } from './calendar-toolbar';
import { WeekView } from './week-view';
import { MonthView } from './month-view';
import { EventPopover } from './event-popover';

export function BookingCalendar() {
  const { role, isLoading: clubLoading } = useClub();
  const {
    currentDate,
    view,
    setView,
    navigateForward,
    navigateBack,
    goToToday,
    dateRange,
  } = useCalendarNavigation();

  const { data: events = [], isLoading: eventsLoading } =
    useCalendarBookings(dateRange);

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setPopoverOpen(true);
  }, []);

  const handleDayClick = useCallback(
    (date: Date) => {
      setView('week');
    },
    [setView]
  );

  const showCoach = role === 'admin';
  const isLoading = clubLoading || eventsLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onNavigateBack={navigateBack}
        onNavigateForward={navigateForward}
        onToday={goToToday}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading schedule...</p>
          </div>
        </div>
      ) : view === 'week' ? (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
          showCoach={showCoach}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          events={events}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      )}

      <EventPopover
        event={selectedEvent}
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        role={role}
      />
    </div>
  );
}
