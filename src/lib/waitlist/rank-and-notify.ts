import type { WaitlistEntry, Booking } from '@/types';

interface WaitlistCandidate extends WaitlistEntry {
  _recalculated_priority?: number;
}

/**
 * Calculates the priority score for a waitlist candidate based on:
 * - Proximity (60%): How close the desired time matches the cancelled slot
 * - Loyalty (30%): How many past bookings with this coach
 * - Urgency (10%): How long they've been on the waitlist
 */
export function calculatePriorityScore(
  candidate: WaitlistCandidate,
  cancelledSlot: { starts_at: string; ends_at: string }
): number {
  // Proximity score (0-100)
  let proximityScore = 100; // default if no time preference
  if (candidate.desired_start_time) {
    const desiredMinutes = timeToMinutes(candidate.desired_start_time);
    const slotMinutes = timeToMinutes(
      new Date(cancelledSlot.starts_at).toTimeString().slice(0, 8)
    );
    const diffMinutes = Math.abs(desiredMinutes - slotMinutes);
    proximityScore = Math.max(0, 100 - (diffMinutes / 120) * 100);
  }

  // Loyalty score (0-100)
  const loyaltyScore = Math.min(100, (candidate.booking_history_count || 0) * 10);

  // Urgency score (0-100)
  const hoursWaiting =
    (Date.now() - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60);
  const urgencyScore = Math.min(100, hoursWaiting * 2);

  return (
    proximityScore * 0.6 + loyaltyScore * 0.3 + urgencyScore * 0.1
  );
}

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Ranks waitlist candidates for a given cancelled slot.
 * Returns sorted array (highest priority first).
 */
export function rankCandidates(
  candidates: WaitlistCandidate[],
  cancelledSlot: { starts_at: string; ends_at: string }
): WaitlistCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      _recalculated_priority: calculatePriorityScore(c, cancelledSlot),
    }))
    .sort((a, b) => (b._recalculated_priority || 0) - (a._recalculated_priority || 0));
}
