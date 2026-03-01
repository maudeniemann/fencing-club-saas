import {
  format,
  getDay,
  isAfter,
  isBefore,
  parse,
  eachDayOfInterval,
} from 'date-fns';
import type { AvailabilitySlot, Booking, ComputedSlot } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GetAvailableSlotsParams {
  supabase: any;
  clubId: string;
  coachMemberId: string;
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Computes real-time available slots by merging:
 * 1. Recurring availability patterns
 * 2. One-off availability slots
 * 3. Blocked dates
 * 4. Existing confirmed bookings (to exclude booked times)
 */
export async function getAvailableSlots({
  supabase,
  clubId,
  coachMemberId,
  dateFrom,
  dateTo,
}: GetAvailableSlotsParams): Promise<ComputedSlot[]> {
  // Fetch all availability slots for this coach
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('club_id', clubId)
    .eq('coach_member_id', coachMemberId);

  // Fetch existing confirmed bookings in the date range
  const { data: bookings } = await supabase
    .from('bookings')
    .select('starts_at, ends_at, status')
    .eq('coach_member_id', coachMemberId)
    .eq('club_id', clubId)
    .in('status', ['confirmed', 'completed'])
    .gte('starts_at', dateFrom.toISOString())
    .lte('starts_at', dateTo.toISOString());

  const availabilitySlots = (slots || []) as AvailabilitySlot[];
  const existingBookings = (bookings || []) as Pick<Booking, 'starts_at' | 'ends_at' | 'status'>[];

  // Generate all dates in the range
  const allDates = eachDayOfInterval({ start: dateFrom, end: dateTo });

  const computedSlots: ComputedSlot[] = [];

  for (const date of allDates) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = getDay(date); // 0 = Sunday

    // Collect blocked dates for this day
    const isBlocked = availabilitySlots.some(
      (slot) =>
        slot.is_blocked &&
        ((slot.is_recurring && slot.day_of_week === dayOfWeek) ||
          (!slot.is_recurring && slot.slot_date === dateStr))
    );

    if (isBlocked) continue;

    // Collect available time windows for this day
    const daySlots = availabilitySlots.filter((slot) => {
      if (slot.is_blocked) return false;

      if (slot.is_recurring) {
        if (slot.day_of_week !== dayOfWeek) return false;
        if (slot.recurrence_start && isBefore(date, new Date(slot.recurrence_start))) return false;
        if (slot.recurrence_end && isAfter(date, new Date(slot.recurrence_end))) return false;
        return true;
      }

      return slot.slot_date === dateStr;
    });

    for (const slot of daySlots) {
      // Check if this slot overlaps with any existing booking
      const slotStart = parse(`${dateStr} ${slot.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
      const slotEnd = parse(`${dateStr} ${slot.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());

      const isBooked = existingBookings.some((booking) => {
        const bookingStart = new Date(booking.starts_at);
        const bookingEnd = new Date(booking.ends_at);
        // Overlap check: slot starts before booking ends AND slot ends after booking starts
        return isBefore(slotStart, bookingEnd) && isAfter(slotEnd, bookingStart);
      });

      computedSlots.push({
        date: dateStr,
        start_time: slot.start_time,
        end_time: slot.end_time,
        coach_member_id: coachMemberId,
        venue_id: slot.venue_id,
        strip_id: slot.strip_id,
        is_booked: isBooked,
        allowed_lesson_type_ids: slot.allowed_lesson_type_ids,
      });
    }
  }

  return computedSlots;
}

/**
 * Checks if a specific time slot is available for booking.
 * Used as a double-booking prevention check during booking creation.
 */
export async function isSlotAvailable(
  supabase: any,
  coachMemberId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('coach_member_id', coachMemberId)
    .in('status', ['confirmed', 'completed'])
    .lt('starts_at', endsAt.toISOString())
    .gt('ends_at', startsAt.toISOString());

  return (count || 0) === 0;
}
