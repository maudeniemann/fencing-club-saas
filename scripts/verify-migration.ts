import * as fs from 'fs';
import * as path from 'path';
import { createAdminClient, CLUB_ID } from './lib/supabase-admin';

const DATA_DIR = path.join(__dirname, 'data');

async function main() {
  const supabase = createAdminClient();

  console.log('=== MIGRATION VERIFICATION ===\n');
  console.log(`Club ID: ${CLUB_ID}\n`);

  // ── Count verification ──
  console.log('--- Row Counts ---');

  const tables = [
    'club_members',
    'venues',
    'lesson_types',
    'bookings',
    'booking_participants',
    'payments',
  ] as const;

  const counts: Record<string, number> = {};

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('club_id', CLUB_ID);

    counts[table] = count ?? 0;
    console.log(`  ${table}: ${count ?? `ERROR: ${error?.message}`}`);
  }

  // ── Compare with scraped data ──
  console.log('\n--- Scraped Data Comparison ---');

  const files = [
    { file: 'reservations.json', table: 'bookings' },
    { file: 'payments.json', table: 'payments' },
  ];

  for (const { file, table } of files) {
    const filepath = path.join(DATA_DIR, file);
    if (fs.existsSync(filepath)) {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      console.log(
        `  ${file}: ${data.length} scraped → ${counts[table] ?? '?'} in DB`
      );
    } else {
      console.log(`  ${file}: not found`);
    }
  }

  // ── Migration report ──
  const reportPath = path.join(DATA_DIR, 'migration-report.json');
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    console.log('\n--- Migration Report Summary ---');
    console.log(`  Migrated at: ${report.timestamp}`);
    console.log(`  Bookings created: ${report.bookings_created}`);
    console.log(`  Bookings skipped: ${report.bookings_skipped}`);
    console.log(`  Payments created: ${report.payments_created}`);
    console.log(`  Payments skipped: ${report.payments_skipped}`);
    console.log(`  Unmatched names: ${report.unmatched_names}`);
    console.log(`  Total errors: ${report.total_errors}`);
  }

  // ── Spot check: recent bookings ──
  console.log('\n--- Sample Bookings (latest 5) ---');
  const { data: sampleBookings } = await supabase
    .from('bookings')
    .select(
      `
      id,
      starts_at,
      ends_at,
      status,
      notes,
      coach:club_members!bookings_coach_member_id_fkey(display_name),
      lesson_type:lesson_types(name),
      venue:venues(name)
    `
    )
    .eq('club_id', CLUB_ID)
    .order('starts_at', { ascending: false })
    .limit(5);

  if (sampleBookings && sampleBookings.length > 0) {
    for (const b of sampleBookings) {
      const coach = (b.coach as any)?.display_name ?? 'unknown';
      const lessonType = (b.lesson_type as any)?.name ?? 'unknown';
      const venue = (b.venue as any)?.name ?? 'no venue';
      console.log(
        `  ${b.starts_at} | ${coach} | ${lessonType} | ${venue} | ${b.status}`
      );
    }
  } else {
    console.log('  No bookings found');
  }

  // ── Spot check: participants per booking ──
  console.log('\n--- Sample Booking Participants (from latest booking) ---');
  if (sampleBookings && sampleBookings.length > 0) {
    const { data: participants } = await supabase
      .from('booking_participants')
      .select(
        `
        player:club_members!booking_participants_player_member_id_fkey(display_name),
        price_charged_cents,
        status
      `
      )
      .eq('booking_id', sampleBookings[0].id);

    if (participants && participants.length > 0) {
      for (const p of participants) {
        const name = (p.player as any)?.display_name ?? 'unknown';
        console.log(
          `  ${name} | $${(p.price_charged_cents / 100).toFixed(2)} | ${p.status}`
        );
      }
    } else {
      console.log('  No participants found');
    }
  }

  // ── Coach distribution ──
  console.log('\n--- Bookings by Coach ---');
  const { data: coaches } = await supabase
    .from('club_members')
    .select('id, display_name')
    .eq('club_id', CLUB_ID)
    .eq('role', 'coach');

  if (coaches) {
    for (const coach of coaches) {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', CLUB_ID)
        .eq('coach_member_id', coach.id);
      if (count && count > 0) {
        console.log(`  ${coach.display_name}: ${count} bookings`);
      }
    }
  }

  // ── Booking status distribution ──
  console.log('\n--- Bookings by Status ---');
  for (const status of ['completed', 'confirmed', 'cancelled', 'no_show', 'disputed']) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', CLUB_ID)
      .eq('status', status);
    if (count && count > 0) {
      console.log(`  ${status}: ${count}`);
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
