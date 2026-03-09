// Derive coach availability slots from historical booking patterns
// Analyzes bookings in Supabase to determine when each coach typically works

import { createAdminClient, CLUB_ID } from './lib/supabase-admin';

interface BookingRow {
  id: string;
  coach_member_id: string;
  venue_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  lesson_type_id: string;
}

interface CoachInfo {
  id: string;
  display_name: string;
}

interface DayPattern {
  dayOfWeek: number; // 0=Sun, 6=Sat
  earliestTime: string; // "HH:MM"
  latestTime: string;
  venueId: string | null;
  venueCounts: Map<string, number>;
  lessonTypeIds: Set<string>;
  bookingCount: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_BOOKINGS_FOR_PATTERN = 3; // Need at least 3 bookings on a day to establish a pattern
const BUFFER_MINUTES = 30; // Add 30-min buffer before earliest and after latest

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.max(0, minutes) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function extractTime(isoString: string): string {
  // Parse the time from a timestamptz, converting to ET
  const date = new Date(isoString);
  // Use Intl to get ET time
  const etTime = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return etTime;
}

function getDayOfWeek(isoString: string): number {
  const date = new Date(isoString);
  // Get day of week in ET
  const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return etDate.getDay();
}

async function main() {
  const supabase = createAdminClient();

  console.log('=== DERIVING COACH AVAILABILITY FROM BOOKING PATTERNS ===\n');
  console.log(`Club ID: ${CLUB_ID}\n`);

  // Step 1: Get all coaches
  const { data: coaches, error: coachError } = await supabase
    .from('club_members')
    .select('id, display_name')
    .eq('club_id', CLUB_ID)
    .eq('role', 'coach')
    .eq('is_active', true);

  if (coachError || !coaches) {
    console.error(`Failed to load coaches: ${coachError?.message}`);
    process.exit(1);
  }
  console.log(`Found ${coaches.length} active coaches\n`);

  // Step 2: Check for existing availability slots
  const { count: existingCount } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID);

  if (existingCount && existingCount > 0) {
    console.log(`WARNING: ${existingCount} availability slots already exist.`);
    console.log('  Skipping coaches that already have slots.\n');
  }

  // Step 3: For each coach, analyze booking patterns
  let totalSlotsCreated = 0;

  for (const coach of coaches as CoachInfo[]) {
    console.log(`\nAnalyzing: ${coach.display_name}`);

    // Check if coach already has availability slots
    const { count: coachSlotCount } = await supabase
      .from('availability_slots')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', CLUB_ID)
      .eq('coach_member_id', coach.id);

    if (coachSlotCount && coachSlotCount > 0) {
      console.log(`  Already has ${coachSlotCount} slots — skipping`);
      continue;
    }

    // Fetch all bookings for this coach (only recent 2 years for relevance)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, coach_member_id, venue_id, starts_at, ends_at, status, lesson_type_id')
      .eq('club_id', CLUB_ID)
      .eq('coach_member_id', coach.id)
      .gte('starts_at', twoYearsAgo.toISOString())
      .in('status', ['completed', 'confirmed'])
      .order('starts_at');

    if (bookingError || !bookings) {
      console.log(`  Error loading bookings: ${bookingError?.message}`);
      continue;
    }

    if (bookings.length === 0) {
      console.log('  No bookings found — skipping');
      continue;
    }

    console.log(`  ${bookings.length} bookings in last 2 years`);

    // Group by day of week
    const dayPatterns = new Map<number, DayPattern>();

    for (const booking of bookings as BookingRow[]) {
      const dayOfWeek = getDayOfWeek(booking.starts_at);
      const startTime = extractTime(booking.starts_at);
      const endTime = extractTime(booking.ends_at);

      if (!dayPatterns.has(dayOfWeek)) {
        dayPatterns.set(dayOfWeek, {
          dayOfWeek,
          earliestTime: startTime,
          latestTime: endTime,
          venueId: null,
          venueCounts: new Map<string, number>(),
          lessonTypeIds: new Set<string>(),
          bookingCount: 0,
        });
      }

      const pattern = dayPatterns.get(dayOfWeek)!;
      pattern.bookingCount++;

      // Track earliest/latest times
      if (timeToMinutes(startTime) < timeToMinutes(pattern.earliestTime)) {
        pattern.earliestTime = startTime;
      }
      if (timeToMinutes(endTime) > timeToMinutes(pattern.latestTime)) {
        pattern.latestTime = endTime;
      }

      // Track venue frequency
      if (booking.venue_id) {
        pattern.venueCounts.set(
          booking.venue_id,
          (pattern.venueCounts.get(booking.venue_id) || 0) + 1
        );
      }

      // Track lesson types
      if (booking.lesson_type_id) {
        pattern.lessonTypeIds.add(booking.lesson_type_id);
      }
    }

    // Create availability slots for days with enough bookings
    const slotsToInsert: Array<{
      club_id: string;
      coach_member_id: string;
      is_recurring: boolean;
      day_of_week: number;
      start_time: string;
      end_time: string;
      venue_id: string | null;
      allowed_lesson_type_ids: string[] | null;
      is_blocked: boolean;
    }> = [];

    for (const [dayOfWeek, pattern] of dayPatterns) {
      if (pattern.bookingCount < MIN_BOOKINGS_FOR_PATTERN) {
        console.log(`  ${DAY_NAMES[dayOfWeek]}: ${pattern.bookingCount} bookings (below threshold) — skipping`);
        continue;
      }

      // Find most common venue
      let mostCommonVenue: string | null = null;
      let maxVenueCount = 0;
      for (const [venueId, count] of pattern.venueCounts) {
        if (count > maxVenueCount) {
          maxVenueCount = count;
          mostCommonVenue = venueId;
        }
      }

      // Add buffer to times
      const earliestMinutes = timeToMinutes(pattern.earliestTime) - BUFFER_MINUTES;
      const latestMinutes = timeToMinutes(pattern.latestTime) + BUFFER_MINUTES;

      const startTime = minutesToTime(Math.max(0, earliestMinutes));
      const endTime = minutesToTime(Math.min(23 * 60 + 59, latestMinutes));

      slotsToInsert.push({
        club_id: CLUB_ID,
        coach_member_id: coach.id,
        is_recurring: true,
        day_of_week: dayOfWeek,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        venue_id: mostCommonVenue,
        allowed_lesson_type_ids: pattern.lessonTypeIds.size > 0 ? [...pattern.lessonTypeIds] : null,
        is_blocked: false,
      });

      console.log(`  ${DAY_NAMES[dayOfWeek]}: ${pattern.bookingCount} bookings → ${startTime}-${endTime}`);
    }

    // Insert slots
    if (slotsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('availability_slots')
        .insert(slotsToInsert);

      if (insertError) {
        console.error(`  Failed to insert slots: ${insertError.message}`);
      } else {
        console.log(`  Created ${slotsToInsert.length} availability slots`);
        totalSlotsCreated += slotsToInsert.length;
      }
    } else {
      console.log('  No patterns strong enough to create slots');
    }
  }

  // Summary
  console.log('\n=== AVAILABILITY DERIVATION COMPLETE ===');
  console.log(`  Total slots created: ${totalSlotsCreated}`);

  // Verify
  const { count: finalCount } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID);
  console.log(`  Total slots in DB: ${finalCount}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
