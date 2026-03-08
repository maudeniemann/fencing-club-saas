'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, format, addDays, parse, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  slot_date: string | null;
  is_recurring: boolean;
  day_of_week: number | null;
}

interface Booking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export default function CoachAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: coachId } = use(params);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const weekStart = startOfWeek(addWeeks(new Date(), currentWeekOffset), { weekStartsOn: 0 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: coach } = useQuery({
    queryKey: ['coach', coachId],
    queryFn: async () => {
      const res = await fetch(`/api/coaches/${coachId}`);
      if (!res.ok) throw new Error('Failed to fetch coach');
      return res.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['coach-availability', coachId, weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/coaches/${coachId}/availability?start_date=${format(weekStart, 'yyyy-MM-dd')}&end_date=${format(weekEnd, 'yyyy-MM-dd')}`
      );
      if (!res.ok) throw new Error('Failed to fetch availability');
      return res.json() as Promise<{
        availability_slots: AvailabilitySlot[];
        bookings: Booking[];
      }>;
    },
  });

  const getSlotsForDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const slots: Array<AvailabilitySlot & { isBooked: boolean }> = [];

    // Get recurring slots for this day of week
    data?.availability_slots
      .filter(slot => slot.is_recurring && slot.day_of_week === dayOfWeek)
      .forEach(slot => {
        const startDateTime = parse(`${dateStr} ${slot.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        const endDateTime = parse(`${dateStr} ${slot.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        
        // Check if this slot is booked
        const isBooked = data?.bookings.some(booking => {
          const bookingStart = new Date(booking.starts_at);
          const bookingEnd = new Date(booking.ends_at);
          return isWithinInterval(bookingStart, { start: startDateTime, end: endDateTime }) ||
                 isWithinInterval(startDateTime, { start: bookingStart, end: bookingEnd });
        }) || false;

        slots.push({ ...slot, isBooked });
      });

    // Get one-time slots for this specific date
    data?.availability_slots
      .filter(slot => !slot.is_recurring && slot.slot_date === dateStr)
      .forEach(slot => {
        const startDateTime = parse(`${dateStr} ${slot.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        const endDateTime = parse(`${dateStr} ${slot.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        
        const isBooked = data?.bookings.some(booking => {
          const bookingStart = new Date(booking.starts_at);
          const bookingEnd = new Date(booking.ends_at);
          return isWithinInterval(bookingStart, { start: startDateTime, end: endDateTime }) ||
                 isWithinInterval(startDateTime, { start: bookingStart, end: bookingEnd });
        }) || false;

        slots.push({ ...slot, isBooked });
      });

    // Sort by start time
    slots.sort((a, b) => a.start_time.localeCompare(b.start_time));

    return slots;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {coach?.display_name || 'Coach'} Availability
        </h1>
        <p className="text-muted-foreground">
          View available time slots for booking
        </p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous Week
        </Button>

        <div className="text-sm font-medium">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
        >
          Next Week
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {currentWeekOffset !== 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentWeekOffset(0)}
          className="w-full"
        >
          Back to This Week
        </Button>
      )}

      {/* Weekly Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {daysInWeek.map((day) => {
          const slots = getSlotsForDay(day);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <Card key={day.toISOString()} className={isPast ? 'opacity-50' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {format(day, 'EEEE, MMM d')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {slots.length > 0 ? (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-2 rounded-md text-sm ${
                        slot.isBooked
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-green-100 dark:bg-green-900/20 text-green-900 dark:text-green-100'
                      }`}
                    >
                      <div className="font-medium">
                        {format(parse(slot.start_time, 'HH:mm:ss', new Date()), 'h:mm a')} -{' '}
                        {format(parse(slot.end_time, 'HH:mm:ss', new Date()), 'h:mm a')}
                      </div>
                      {slot.isBooked && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          Booked
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No availability
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
