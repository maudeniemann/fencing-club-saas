import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checks for double-booking conflicts before creating a booking.
 * Returns true if there IS a conflict (slot is NOT available).
 */
export async function hasBookingConflict(
  supabase: SupabaseClient,
  coachMemberId: string,
  startsAt: string,
  endsAt: string,
  excludeBookingId?: string
): Promise<boolean> {
  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('coach_member_id', coachMemberId)
    .in('status', ['confirmed', 'completed'])
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { count } = await query;
  return (count || 0) > 0;
}

/**
 * Checks if a player already has a booking at the same time.
 */
export async function hasPlayerConflict(
  supabase: SupabaseClient,
  playerMemberId: string,
  startsAt: string,
  endsAt: string,
  excludeBookingId?: string
): Promise<boolean> {
  // Get the player's booking IDs
  let query = supabase
    .from('booking_participants')
    .select('booking_id, bookings!inner(starts_at, ends_at, status)')
    .eq('player_member_id', playerMemberId)
    .eq('status', 'confirmed');

  const { data } = await query;

  if (!data) return false;

  return data.some((bp) => {
    const booking = bp.bookings as unknown as { starts_at: string; ends_at: string; status: string };
    if (booking.status !== 'confirmed' && booking.status !== 'completed') return false;
    if (excludeBookingId && bp.booking_id === excludeBookingId) return false;
    // Overlap check
    return booking.starts_at < endsAt && booking.ends_at > startsAt;
  });
}
