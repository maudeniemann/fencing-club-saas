// Fix remaining data issues:
// 1. Remove spurious "de" venue
// 2. Add real addresses to venues
// 3. Link availability slots to most common venue per coach
// 4. Verify all data integrity

import { createAdminClient, CLUB_ID } from './lib/supabase-admin';

async function main() {
  const supabase = createAdminClient();

  console.log('=== FIXING DATA ISSUES ===\n');

  // 1. Remove spurious "de" venue
  console.log('--- Step 1: Remove spurious "de" venue ---');
  const { data: deVenue } = await supabase
    .from('venues')
    .select('id')
    .eq('club_id', CLUB_ID)
    .eq('name', 'de')
    .single();

  if (deVenue) {
    // Check if any bookings reference it
    const { count: bookingsWithDeVenue } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', deVenue.id);

    if (bookingsWithDeVenue && bookingsWithDeVenue > 0) {
      console.log(`  WARNING: ${bookingsWithDeVenue} bookings reference "de" venue - setting to null first`);
      await supabase.from('bookings').update({ venue_id: null }).eq('venue_id', deVenue.id);
    }

    // Check availability slots
    const { count: slotsWithDeVenue } = await supabase
      .from('availability_slots')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', deVenue.id);

    if (slotsWithDeVenue && slotsWithDeVenue > 0) {
      console.log(`  WARNING: ${slotsWithDeVenue} availability slots reference "de" venue - setting to null`);
      await supabase.from('availability_slots').update({ venue_id: null }).eq('venue_id', deVenue.id);
    }

    // Check strips
    await supabase.from('strips').delete().eq('venue_id', deVenue.id);

    const { error: deleteError } = await supabase
      .from('venues')
      .delete()
      .eq('id', deVenue.id);

    if (deleteError) {
      console.log(`  Failed to delete: ${deleteError.message}`);
    } else {
      console.log('  Deleted "de" venue successfully');
    }
  } else {
    console.log('  No "de" venue found — already clean');
  }

  // 2. Update venue addresses
  console.log('\n--- Step 2: Update venue addresses ---');
  const venueAddresses: Record<string, string> = {
    'Blue Gym (Newton)': '328 Watertown St, Newton, MA 02458',
    'Yellow Gym (Newton)': '328 Watertown St, Newton, MA 02458',
    'White Gym (Wellesley)': '904 Worcester St, Wellesley, MA 02482',
    'On line': 'Online (Virtual)',
  };

  for (const [name, address] of Object.entries(venueAddresses)) {
    const { error } = await supabase
      .from('venues')
      .update({ address })
      .eq('club_id', CLUB_ID)
      .eq('name', name);

    if (error) {
      console.log(`  Failed to update ${name}: ${error.message}`);
    } else {
      console.log(`  Updated ${name} → ${address}`);
    }
  }

  // 3. Link availability slots to most common venue per coach
  console.log('\n--- Step 3: Link availability slots to venues ---');

  // Get all slots missing venue_id
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, coach_member_id, day_of_week, venue_id')
    .eq('club_id', CLUB_ID)
    .is('venue_id', null);

  if (slots && slots.length > 0) {
    console.log(`  ${slots.length} slots missing venue_id`);

    // For each coach, find their most common venue from bookings
    const coachIds = [...new Set(slots.map(s => s.coach_member_id))];

    for (const coachId of coachIds) {
      // Get coach name
      const { data: coach } = await supabase
        .from('club_members')
        .select('display_name')
        .eq('id', coachId)
        .single();

      // Find most common venue per day from bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('venue_id, starts_at')
        .eq('coach_member_id', coachId)
        .not('venue_id', 'is', null)
        .in('status', ['completed', 'confirmed']);

      if (!bookings || bookings.length === 0) {
        console.log(`  ${coach?.display_name}: no bookings with venues`);
        continue;
      }

      // Group by day of week, find most common venue per day
      const dayVenueCounts = new Map<number, Map<string, number>>();
      for (const b of bookings) {
        const date = new Date(b.starts_at);
        const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const dow = etDate.getDay();

        if (!dayVenueCounts.has(dow)) dayVenueCounts.set(dow, new Map());
        const vc = dayVenueCounts.get(dow)!;
        vc.set(b.venue_id, (vc.get(b.venue_id) || 0) + 1);
      }

      // Update each slot
      const coachSlots = slots.filter(s => s.coach_member_id === coachId);
      for (const slot of coachSlots) {
        const vc = dayVenueCounts.get(slot.day_of_week);
        if (vc) {
          let bestVenue = '';
          let bestCount = 0;
          for (const [vid, count] of vc) {
            if (count > bestCount) { bestVenue = vid; bestCount = count; }
          }
          if (bestVenue) {
            await supabase
              .from('availability_slots')
              .update({ venue_id: bestVenue })
              .eq('id', slot.id);
          }
        }
      }
      console.log(`  ${coach?.display_name}: linked ${coachSlots.length} slots to venues`);
    }
  } else {
    console.log('  All slots already have venue_id');
  }

  // 4. Final verification
  console.log('\n--- Step 4: Final verification ---');

  const { data: venues } = await supabase
    .from('venues')
    .select('name, address')
    .eq('club_id', CLUB_ID);
  console.log('  Venues:', venues?.map(v => `${v.name} (${v.address})`).join(', '));

  const { count: slotCount } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID);
  console.log(`  Total availability slots: ${slotCount}`);

  const { count: nullVenueSlots } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID)
    .is('venue_id', null);
  console.log(`  Slots without venue: ${nullVenueSlots}`);

  const { data: members } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', CLUB_ID);

  const roleCounts: Record<string, number> = {};
  for (const m of members || []) {
    roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
  }
  console.log('  Members by role:', JSON.stringify(roleCounts));

  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID);
  console.log(`  Total bookings: ${bookingCount}`);

  console.log('\n=== DATA FIX COMPLETE ===');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
