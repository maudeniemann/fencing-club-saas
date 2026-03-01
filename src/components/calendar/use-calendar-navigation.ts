'use client';

import { useState, useCallback, useMemo } from 'react';
import { addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import type { CalendarView } from './calendar-types';
import { getDateRange } from './calendar-utils';

export function useCalendarNavigation() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');

  const navigateForward = useCallback(() => {
    setCurrentDate((d) => (view === 'week' ? addWeeks(d, 1) : addMonths(d, 1)));
  }, [view]);

  const navigateBack = useCallback(() => {
    setCurrentDate((d) => (view === 'week' ? subWeeks(d, 1) : subMonths(d, 1)));
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const dateRange = useMemo(
    () => getDateRange(currentDate, view),
    [currentDate, view]
  );

  return {
    currentDate,
    view,
    setView,
    navigateForward,
    navigateBack,
    goToToday,
    dateRange,
  };
}
