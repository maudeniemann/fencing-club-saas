import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, CLUB_ID } from './lib/supabase-admin';
import { NameMatcher, type MemberInfo } from './lib/name-matcher';
import type {
  ScrapedReservation,
  ScrapedClassSchedule,
  ScrapedSettings,
} from './lib/types';

const DATA_DIR = path.join(__dirname, 'data');

// ─── Helpers ──────────────────────────────────────────────────

function readJSON<T>(filename: string): T {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`File not found: ${filepath} — returning empty array`);
    return [] as unknown as T;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

/** Get the correct UTC offset for a date in America/New_York */
function getETOffset(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
  return tzName === 'EDT' ? '-04:00' : '-05:00';
}

function mapStatus(status: string, date: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('no show') || lower.includes('no-show')) return 'no_show';
  if (lower.includes('dispute')) return 'disputed';
  const lessonDate = new Date(date);
  if (lessonDate < new Date()) return 'completed';
  return 'confirmed';
}

// Missing coaches not in the seed data
const MISSING_COACHES = [
  'Kiryl Kirpichou',
  'Simon Kushkov',
  'Yelyzaveta Melnychuk',
  'Nina Nadtocheva',
];

// ─── Step 0: Add Missing Coaches ─────────────────────────────

async function addMissingCoaches(): Promise<void> {
  const supabase = createAdminClient();
  console.log('Adding missing coaches...');

  for (const name of MISSING_COACHES) {
    // Check if already exists as club_member
    const { data: existing } = await supabase
      .from('club_members')
      .select('id, role')
      .eq('club_id', CLUB_ID)
      .eq('display_name', name)
      .maybeSingle();

    if (existing) {
      if (existing.role !== 'coach') {
        // Simon Kushkov is seeded as player — update to coach
        await supabase
          .from('club_members')
          .update({ role: 'coach' })
          .eq('id', existing.id);
        console.log(`  Updated ${name}: ${existing.role} → coach`);
      } else {
        console.log(`  ${name} already exists as coach`);
      }
      continue;
    }

    // Need to create auth user first, then club_member (same as seed script)
    const email = name
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .trim()
      .replace(/\s+/g, '.')
      + '.coach@seed.fencing-club.local';

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (authError) {
      console.error(`  Failed to create auth user for ${name}: ${authError.message}`);
      continue;
    }

    const { error: memberError } = await supabase.from('club_members').insert({
      club_id: CLUB_ID,
      user_id: authUser.user.id,
      role: 'coach',
      display_name: name,
      commission_rate: 0.70,
      specialties: ['epee', 'foil', 'sabre'],
    });

    if (memberError) {
      console.error(`  Failed to create member for ${name}: ${memberError.message}`);
    } else {
      console.log(`  Added coach: ${name}`);
    }
  }
}

// ─── Step 1: Build Member Lookup ─────────────────────────────

async function buildMemberLookup(): Promise<NameMatcher> {
  const supabase = createAdminClient();
  const { data: members, error } = await supabase
    .from('club_members')
    .select('id, display_name, role')
    .eq('club_id', CLUB_ID)
    .eq('is_active', true);

  if (error) throw new Error(`Failed to load members: ${error.message}`);
  console.log(`Loaded ${members?.length ?? 0} club members from Supabase`);
  return new NameMatcher(members as MemberInfo[]);
}

// ─── Step 2: Migrate Venues ──────────────────────────────────

async function migrateVenues(
  settings: ScrapedSettings
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const venueMap = new Map<string, string>();

  const venueNames = settings.venues?.map((v) => v.name.trim()) ?? [];
  if (venueNames.length === 0) venueNames.push('Dynamo Fencing Center');

  for (const name of venueNames) {
    const { data, error } = await supabase
      .from('venues')
      .insert({ club_id: CLUB_ID, name, is_active: true })
      .select('id')
      .single();

    if (error) {
      // Might already exist
      const { data: existing } = await supabase
        .from('venues')
        .select('id')
        .eq('club_id', CLUB_ID)
        .eq('name', name)
        .maybeSingle();
      if (existing) {
        venueMap.set(name, existing.id);
        console.log(`  Venue exists: ${name}`);
      } else {
        console.error(`  Failed to create venue "${name}": ${error.message}`);
      }
    } else if (data) {
      venueMap.set(name, data.id);
      console.log(`  Created venue: ${name}`);
    }
  }

  // Also map location keywords to venue IDs
  for (const [name, id] of venueMap) {
    if (name.includes('Newton')) {
      venueMap.set('Newton', id);
    } else if (name.includes('Wellesley')) {
      venueMap.set('Wellesley', id);
    }
  }

  return venueMap;
}

// ─── Step 3: Migrate Lesson Types ────────────────────────────

async function migrateLessonTypes(
  settings: ScrapedSettings,
  reservations: ScrapedReservation[]
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const typeMap = new Map<string, string>();

  if (settings.lesson_types?.length > 0) {
    for (const lt of settings.lesson_types) {
      const category = lt.category?.toLowerCase().includes('group')
        ? 'group'
        : lt.category?.toLowerCase().includes('clinic')
          ? 'clinic'
          : 'private';

      // Estimate duration from matching reservations
      const matchingRes = reservations.filter(
        (r) => r.lesson_type === lt.name && r.start_time && r.end_time
      );
      let durationMinutes = lt.duration_minutes || 60;
      if (matchingRes.length > 0) {
        const durations = matchingRes.map((r) => diffMinutes(r.start_time, r.end_time)).filter((d) => d > 0);
        if (durations.length > 0) {
          durationMinutes = durations[Math.floor(durations.length / 2)];
        }
      }

      const { data, error } = await supabase
        .from('lesson_types')
        .insert({
          club_id: CLUB_ID,
          name: lt.name,
          category,
          duration_minutes: durationMinutes > 0 ? durationMinutes : 20,
          max_participants: lt.max_participants || (category === 'private' ? 1 : 10),
          price_cents: 0,
          currency: 'usd',
          is_active: true,
          description: 'Legacy import',
        })
        .select('id')
        .single();

      if (data) {
        typeMap.set(lt.name, data.id);
        console.log(`  Created: ${lt.name} (${category}, ${durationMinutes}min)`);
      } else if (error) {
        // Check if exists
        const { data: existing } = await supabase
          .from('lesson_types')
          .select('id')
          .eq('club_id', CLUB_ID)
          .eq('name', lt.name)
          .maybeSingle();
        if (existing) {
          typeMap.set(lt.name, existing.id);
          console.log(`  Exists: ${lt.name}`);
        }
      }
    }
  }

  // Ensure "Private" type exists (all scraped reservations use this)
  if (!typeMap.has('Private')) {
    // Calculate median duration from all private lessons
    const privateDurations = reservations
      .filter((r) => r.start_time && r.end_time)
      .map((r) => diffMinutes(r.start_time, r.end_time))
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const medianDuration = privateDurations.length > 0
      ? privateDurations[Math.floor(privateDurations.length / 2)]
      : 20;

    const { data } = await supabase
      .from('lesson_types')
      .insert({
        club_id: CLUB_ID,
        name: 'Private',
        category: 'private',
        duration_minutes: medianDuration,
        max_participants: 1,
        price_cents: 0,
        currency: 'usd',
        is_active: true,
        description: 'Legacy import — private lessons',
      })
      .select('id')
      .single();

    if (data) {
      typeMap.set('Private', data.id);
      console.log(`  Created fallback: Private (${medianDuration}min)`);
    }
  }

  return typeMap;
}

// ─── Step 4: Batch Migrate Bookings + Participants ───────────

async function migrateBookings(
  reservations: ScrapedReservation[],
  matcher: NameMatcher,
  venueMap: Map<string, string>,
  lessonTypeMap: Map<string, string>
): Promise<{ created: number; skipped: number; unmatchedStudents: string[]; errors: string[] }> {
  const supabase = createAdminClient();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  const unmatchedStudents = new Set<string>();

  const fallbackTypeId = lessonTypeMap.get('Private') ?? lessonTypeMap.values().next().value;

  // Pre-resolve all coach matches to avoid repeated lookups
  const coachCache = new Map<string, MemberInfo | null>();
  const instructorNames = new Set(reservations.map((r) => r.instructor_name));
  for (const name of instructorNames) {
    const match = matcher.match(name, 'coach');
    coachCache.set(name, match?.member ?? null);
    if (!match) {
      console.warn(`  No coach match for: "${name}"`);
    }
  }

  // Process in batches of 200
  const BATCH_SIZE = 200;
  const totalBatches = Math.ceil(reservations.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = reservations.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);

    // Prepare booking rows
    const bookingRows: Array<{
      club_id: string;
      coach_member_id: string;
      lesson_type_id: string;
      venue_id: string | null;
      starts_at: string;
      ends_at: string;
      duration_minutes: number;
      status: string;
      notes: string;
    }> = [];

    // Track which reservations map to which booking index
    const validReservations: ScrapedReservation[] = [];

    for (const res of batch) {
      const coach = coachCache.get(res.instructor_name);
      if (!coach) {
        skipped++;
        continue;
      }

      const durationMinutes = diffMinutes(res.start_time, res.end_time);
      if (durationMinutes <= 0) {
        skipped++;
        continue;
      }

      const offset = getETOffset(res.date);
      const startsAt = `${res.date}T${res.start_time}:00${offset}`;
      const endsAt = `${res.date}T${res.end_time}:00${offset}`;
      const status = mapStatus(res.status, res.date);

      // Resolve venue from reservation location
      let venueId: string | null = null;
      if (res.location) {
        venueId = venueMap.get(res.location) ?? null;
      }

      bookingRows.push({
        club_id: CLUB_ID,
        coach_member_id: coach.id,
        lesson_type_id: lessonTypeMap.get(res.lesson_type) ?? fallbackTypeId!,
        venue_id: venueId,
        starts_at: startsAt,
        ends_at: endsAt,
        duration_minutes: durationMinutes,
        status,
        notes: 'Legacy import',
      });

      validReservations.push(res);
    }

    if (bookingRows.length === 0) continue;

    // Batch insert bookings
    const { data: insertedBookings, error: batchError } = await supabase
      .from('bookings')
      .insert(bookingRows)
      .select('id');

    if (batchError || !insertedBookings) {
      errors.push(`Batch ${batchIdx + 1} booking insert failed: ${batchError?.message}`);
      skipped += bookingRows.length;
      continue;
    }

    created += insertedBookings.length;

    // Now insert participants for each booking
    const participantRows: Array<{
      club_id: string;
      booking_id: string;
      player_member_id: string;
      price_charged_cents: number;
      status: string;
    }> = [];

    for (let i = 0; i < insertedBookings.length; i++) {
      const booking = insertedBookings[i];
      const res = validReservations[i];

      for (const studentName of res.student_names) {
        const studentMatch = matcher.match(studentName, 'player');
        if (!studentMatch) {
          // Try matching without role filter
          const anyMatch = matcher.match(studentName);
          if (anyMatch) {
            participantRows.push({
              club_id: CLUB_ID,
              booking_id: booking.id,
              player_member_id: anyMatch.member.id,
              price_charged_cents: 0,
              status: booking.id ? 'completed' : 'confirmed',
            });
          } else {
            unmatchedStudents.add(studentName);
          }
          continue;
        }

        participantRows.push({
          club_id: CLUB_ID,
          booking_id: booking.id,
          player_member_id: studentMatch.member.id,
          price_charged_cents: 0,
          status: res.date < new Date().toISOString().split('T')[0] ? 'completed' : 'confirmed',
        });
      }
    }

    // Batch insert participants
    if (participantRows.length > 0) {
      const { error: pError } = await supabase
        .from('booking_participants')
        .insert(participantRows);

      if (pError) {
        errors.push(`Batch ${batchIdx + 1} participant insert failed: ${pError.message}`);
      }
    }

    if ((batchIdx + 1) % 10 === 0 || batchIdx === totalBatches - 1) {
      console.log(`  Batch ${batchIdx + 1}/${totalBatches}: ${created} bookings created`);
    }
  }

  return { created, skipped, unmatchedStudents: [...unmatchedStudents], errors };
}

// ─── Incremental Updates ──────────────────────────────────────

async function updateLessonDurations(
  reservations: ScrapedReservation[]
): Promise<void> {
  const supabase = createAdminClient();
  console.log('Updating lesson type durations from actual booking data...');

  // Group reservations by lesson_type and calculate actual durations
  const durationsByType = new Map<string, number[]>();
  for (const res of reservations) {
    const dur = diffMinutes(res.start_time, res.end_time);
    if (dur > 0 && dur < 480) { // Sanity check: 0 < duration < 8 hours
      if (!durationsByType.has(res.lesson_type)) {
        durationsByType.set(res.lesson_type, []);
      }
      durationsByType.get(res.lesson_type)!.push(dur);
    }
  }

  // Update each lesson type with median duration
  const { data: lessonTypes } = await supabase
    .from('lesson_types')
    .select('id, name, duration_minutes')
    .eq('club_id', CLUB_ID);

  if (!lessonTypes) return;

  for (const lt of lessonTypes) {
    const durations = durationsByType.get(lt.name);
    if (!durations || durations.length === 0) continue;

    // Calculate median
    const sorted = durations.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (median !== lt.duration_minutes) {
      const { error } = await supabase
        .from('lesson_types')
        .update({ duration_minutes: median })
        .eq('id', lt.id);

      if (error) {
        console.error(`  Failed to update ${lt.name}: ${error.message}`);
      } else {
        console.log(`  ${lt.name}: ${lt.duration_minutes}min → ${median}min (from ${durations.length} bookings)`);
      }
    } else {
      console.log(`  ${lt.name}: already correct at ${median}min`);
    }
  }
}

async function updatePricing(
  reservations: ScrapedReservation[]
): Promise<void> {
  const supabase = createAdminClient();
  console.log('Checking for pricing data from popover details...');

  // Collect prices by lesson type
  const pricesByType = new Map<string, number[]>();
  for (const res of reservations) {
    if (!res.price) continue;
    const priceMatch = res.price.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
    if (!priceMatch) continue;
    const priceCents = Math.round(parseFloat(priceMatch[1].replace(',', '')) * 100);
    if (priceCents > 0 && priceCents < 100000) { // Sanity: $0-$1000
      if (!pricesByType.has(res.lesson_type)) {
        pricesByType.set(res.lesson_type, []);
      }
      pricesByType.get(res.lesson_type)!.push(priceCents);
    }
  }

  if (pricesByType.size === 0) {
    console.log('  No pricing data found in scraped reservations.');
    console.log('  Prices will need to be set manually in the admin panel.');
    return;
  }

  // Update lesson types with median prices
  const { data: lessonTypes } = await supabase
    .from('lesson_types')
    .select('id, name, price_cents')
    .eq('club_id', CLUB_ID);

  if (!lessonTypes) return;

  for (const lt of lessonTypes) {
    const prices = pricesByType.get(lt.name);
    if (!prices || prices.length === 0) continue;

    const sorted = prices.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (median !== lt.price_cents && median > 0) {
      const { error } = await supabase
        .from('lesson_types')
        .update({ price_cents: median })
        .eq('id', lt.id);

      if (error) {
        console.error(`  Failed to update ${lt.name} price: ${error.message}`);
      } else {
        console.log(`  ${lt.name}: $0 → $${(median / 100).toFixed(2)} (from ${prices.length} bookings)`);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  const isIncremental = process.argv.includes('--incremental');

  if (isIncremental) {
    console.log('=== INCREMENTAL MIGRATION UPDATE ===\n');
    console.log('Loading scraped data...');
    const reservations = readJSON<ScrapedReservation[]>('reservations.json');
    console.log(`  Reservations: ${reservations.length}`);

    console.log('\nStep 1: Updating lesson durations...');
    await updateLessonDurations(reservations);

    console.log('\nStep 2: Updating pricing...');
    await updatePricing(reservations);

    console.log('\n=== INCREMENTAL UPDATE COMPLETE ===');
    return;
  }

  console.log('=== LEGACY DATA MIGRATION ===\n');

  // Load scraped data
  console.log('Loading scraped data...');
  const reservations = readJSON<ScrapedReservation[]>('reservations.json');
  const classSchedules = readJSON<ScrapedClassSchedule[]>('class-schedules.json');
  const settings = readJSON<ScrapedSettings>('settings.json');

  console.log(`  Reservations: ${reservations.length}`);
  console.log(`  Class schedules: ${classSchedules.length}`);

  // Step 0: Add missing coaches
  console.log('\nStep 0: Adding missing coaches...');
  await addMissingCoaches();

  // Step 1: Build initial member lookup and check for gaps
  console.log('\nStep 1: Pre-checking name matches...');
  let matcher = await buildMemberLookup();

  const allInstructors = new Set(reservations.map((r) => r.instructor_name));
  const allStudents = new Set(reservations.flatMap((r) => r.student_names));

  // Check coach matches
  let unmatchedCoaches = 0;
  for (const name of allInstructors) {
    const match = matcher.match(name, 'coach');
    if (!match) {
      console.warn(`  Unmatched coach: "${name}"`);
      unmatchedCoaches++;
    } else if (match.confidence !== 'exact') {
      console.log(`  Coach fuzzy match: "${name}" → "${match.member.display_name}" (${match.confidence}, dist=${match.distance})`);
    }
  }

  // Check student matches
  const unmatchedPlayerNames: string[] = [];
  for (const name of allStudents) {
    if (!matcher.match(name)) {
      unmatchedPlayerNames.push(name);
    }
  }
  console.log(`  Coaches: ${allInstructors.size} unique, ${unmatchedCoaches} unmatched`);
  console.log(`  Students: ${allStudents.size} unique, ${unmatchedPlayerNames.length} unmatched`);

  // Step 2: Auto-add unmatched students as new players
  if (unmatchedPlayerNames.length > 0) {
    fs.writeFileSync(
      path.join(DATA_DIR, 'unmatched-names.json'),
      JSON.stringify(unmatchedPlayerNames, null, 2)
    );
    console.log(`\nStep 2: Adding ${unmatchedPlayerNames.length} unmatched students as players...`);
    const supabase = createAdminClient();
    let addedCount = 0;
    for (const name of unmatchedPlayerNames) {
      const email = name
        .toLowerCase()
        .replace(/[^a-z\s-]/g, '')
        .trim()
        .replace(/\s+/g, '.')
        + '.legacy@seed.fencing-club.local';

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (authError) {
        console.warn(`    Failed auth for "${name}": ${authError.message}`);
        continue;
      }

      const { error: memberError } = await supabase.from('club_members').insert({
        club_id: CLUB_ID,
        user_id: authUser.user.id,
        role: 'player',
        display_name: name,
      });
      if (memberError) {
        console.warn(`    Failed member for "${name}": ${memberError.message}`);
      } else {
        addedCount++;
      }
    }
    console.log(`  Added ${addedCount} new players`);
  } else {
    console.log('\nStep 2: All students matched — no new players needed');
  }

  // Rebuild matcher with new coaches + students
  console.log('\n  Rebuilding member lookup after additions...');
  matcher = await buildMemberLookup();

  if (unmatchedCoaches > 0 && !process.env.FORCE_CONTINUE) {
    console.error('  Unmatched coaches detected. Set FORCE_CONTINUE=1 to continue.');
    process.exit(1);
  }

  // Step 3: Migrate venues
  console.log('\nStep 3: Migrating venues...');
  const venueMap = await migrateVenues(settings);
  console.log(`  Total venues: ${venueMap.size}`);

  // Step 4: Migrate lesson types
  console.log('\nStep 4: Migrating lesson types...');
  const lessonTypeMap = await migrateLessonTypes(settings, reservations);
  console.log(`  Total lesson types: ${lessonTypeMap.size}`);

  // Step 5: Migrate bookings + participants
  console.log('\nStep 5: Migrating bookings (batch insert)...');
  const result = await migrateBookings(reservations, matcher, venueMap, lessonTypeMap);
  console.log(`  Bookings created: ${result.created}`);
  console.log(`  Bookings skipped: ${result.skipped}`);
  console.log(`  Unmatched students: ${result.unmatchedStudents.length}`);

  // Write migration report
  const report = {
    timestamp: new Date().toISOString(),
    club_id: CLUB_ID,
    venues_created: venueMap.size,
    lesson_types_created: lessonTypeMap.size,
    bookings_created: result.created,
    bookings_skipped: result.skipped,
    unmatched_students: result.unmatchedStudents,
    total_errors: result.errors.length,
    errors: result.errors.slice(0, 100),
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'migration-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`  Report: scripts/data/migration-report.json`);
  if (result.errors.length > 0) {
    console.warn(`  ${result.errors.length} errors — check the report.`);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
