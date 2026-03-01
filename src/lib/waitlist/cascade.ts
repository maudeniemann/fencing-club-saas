import type { SupabaseClient } from '@supabase/supabase-js';
import { rankCandidates } from './rank-and-notify';
import type { Booking, WaitlistEntry } from '@/types';
import { format } from 'date-fns';

const ACCEPTANCE_WINDOW_MINUTES = 15;

/**
 * Triggered when a booking is cancelled.
 * Finds matching waitlist entries, ranks them, and notifies the top candidate.
 */
export async function triggerWaitlistCascade(
  cancelledBooking: Booking,
  supabase: SupabaseClient
) {
  const cancelledDate = format(new Date(cancelledBooking.starts_at), 'yyyy-MM-dd');

  // Find all waiting entries for same coach + date
  const { data: candidates } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('club_id', cancelledBooking.club_id)
    .eq('coach_member_id', cancelledBooking.coach_member_id)
    .eq('desired_date', cancelledDate)
    .eq('status', 'waiting');

  if (!candidates?.length) return;

  // Rank candidates based on the actual cancelled slot
  const ranked = rankCandidates(
    candidates as WaitlistEntry[],
    cancelledBooking
  );

  // Notify the top-ranked candidate
  await notifyCandidate(ranked[0], cancelledBooking, supabase);
}

/**
 * Notifies a single waitlist candidate that a slot is available.
 * Sets a 15-minute acceptance deadline.
 */
async function notifyCandidate(
  entry: WaitlistEntry,
  slot: Booking,
  supabase: SupabaseClient
) {
  const acceptDeadline = new Date(
    Date.now() + ACCEPTANCE_WINDOW_MINUTES * 60 * 1000
  );

  // Update entry status
  await supabase
    .from('waitlist_entries')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
      accept_deadline: acceptDeadline.toISOString(),
      priority_score: (entry as unknown as Record<string, unknown>)._recalculated_priority as number || entry.priority_score,
    })
    .eq('id', entry.id);

  // Create in-app notification
  const slotTime = format(new Date(slot.starts_at), 'h:mm a');
  const slotDate = format(new Date(slot.starts_at), 'MMM d');

  await supabase.from('notifications').insert({
    club_id: entry.club_id,
    recipient_member_id: entry.player_member_id,
    type: 'waitlist_offer',
    title: 'A slot opened up!',
    body: `A ${slot.duration_minutes}-minute lesson is now available on ${slotDate} at ${slotTime}. Accept within ${ACCEPTANCE_WINDOW_MINUTES} minutes.`,
    data: {
      waitlist_entry_id: entry.id,
      booking_starts_at: slot.starts_at,
      booking_ends_at: slot.ends_at,
      coach_member_id: slot.coach_member_id,
      lesson_type_id: slot.lesson_type_id,
      accept_deadline: acceptDeadline.toISOString(),
    },
  });

  // Also notify parent if the entry was booked by a parent
  if (entry.booked_by_member_id && entry.booked_by_member_id !== entry.player_member_id) {
    await supabase.from('notifications').insert({
      club_id: entry.club_id,
      recipient_member_id: entry.booked_by_member_id,
      type: 'waitlist_offer',
      title: 'A slot opened up!',
      body: `A ${slot.duration_minutes}-minute lesson is now available on ${slotDate} at ${slotTime}. Accept within ${ACCEPTANCE_WINDOW_MINUTES} minutes.`,
      data: {
        waitlist_entry_id: entry.id,
        booking_starts_at: slot.starts_at,
        booking_ends_at: slot.ends_at,
        coach_member_id: slot.coach_member_id,
        lesson_type_id: slot.lesson_type_id,
        accept_deadline: acceptDeadline.toISOString(),
      },
    });
  }
}

/**
 * Called when a waitlist offer expires or is declined.
 * Notifies the next candidate in priority order.
 */
export async function cascadeToNext(
  expiredEntryId: string,
  supabase: SupabaseClient
) {
  // Get the expired entry to find the context
  const { data: expired } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('id', expiredEntryId)
    .single();

  if (!expired) return;

  // Find next waiting candidate for same coach + date
  const { data: nextCandidates } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('club_id', expired.club_id)
    .eq('coach_member_id', expired.coach_member_id)
    .eq('desired_date', expired.desired_date)
    .eq('status', 'waiting')
    .order('priority_score', { ascending: false })
    .limit(1);

  if (!nextCandidates?.length) return;

  // We need the original booking info to notify. Build a synthetic booking.
  // In practice, we'd store this on the waitlist entry or look it up.
  const syntheticBooking: Booking = {
    id: '',
    club_id: expired.club_id,
    booking_number: '',
    coach_member_id: expired.coach_member_id,
    lesson_type_id: expired.lesson_type_id,
    venue_id: null,
    strip_id: null,
    starts_at: `${expired.desired_date}T${expired.desired_start_time || '00:00:00'}`,
    ends_at: `${expired.desired_date}T${expired.desired_end_time || '23:59:59'}`,
    duration_minutes: 60,
    recurring_booking_id: null,
    status: 'cancelled',
    cancelled_at: null,
    cancellation_reason: null,
    cancellation_fee_cents: 0,
    no_show_reported_at: null,
    no_show_reported_by: null,
    google_event_id_coach: null,
    google_event_id_player: null,
    notes: null,
    created_at: '',
    updated_at: '',
    created_by: null,
  };

  await notifyCandidate(nextCandidates[0] as WaitlistEntry, syntheticBooking, supabase);
}
