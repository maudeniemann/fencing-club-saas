import { createAdminClient, CLUB_ID } from './lib/supabase-admin';

async function rollback() {
  const supabase = createAdminClient();
  console.log('=== ROLLING BACK MIGRATION ===\n');

  // Delete in reverse dependency order
  // 1. Booking participants
  const { count: bpCount } = await supabase
    .from('booking_participants')
    .delete({ count: 'exact' })
    .eq('club_id', CLUB_ID);
  console.log(`  Deleted ${bpCount ?? 0} booking participants`);

  // 2. Bookings
  const { count: bCount } = await supabase
    .from('bookings')
    .delete({ count: 'exact' })
    .eq('club_id', CLUB_ID);
  console.log(`  Deleted ${bCount ?? 0} bookings`);

  // 3. Lesson types
  const { count: ltCount } = await supabase
    .from('lesson_types')
    .delete({ count: 'exact' })
    .eq('club_id', CLUB_ID);
  console.log(`  Deleted ${ltCount ?? 0} lesson types`);

  // 4. Strips (dependent on venues)
  const { count: sCount } = await supabase
    .from('strips')
    .delete({ count: 'exact' })
    .eq('club_id', CLUB_ID);
  console.log(`  Deleted ${sCount ?? 0} strips`);

  // 5. Venues
  const { count: vCount } = await supabase
    .from('venues')
    .delete({ count: 'exact' })
    .eq('club_id', CLUB_ID);
  console.log(`  Deleted ${vCount ?? 0} venues`);

  console.log('\n=== ROLLBACK COMPLETE ===');
}

rollback().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
