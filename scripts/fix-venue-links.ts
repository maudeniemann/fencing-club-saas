// Link availability slots and bookings to venues based on instructor metadata
import { createAdminClient, CLUB_ID } from './lib/supabase-admin';
import fs from 'fs';

async function main() {
  const supabase = createAdminClient();
  console.log('=== LINKING VENUES TO AVAILABILITY SLOTS ===\n');

  // Get venues
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('club_id', CLUB_ID);

  const venueByName: Record<string, string> = {};
  for (const v of venues || []) {
    venueByName[v.name] = v.id;
  }

  const blueGym = venueByName['Blue Gym (Newton)'];
  const whiteGym = venueByName['White Gym (Wellesley)'];
  const yellowGym = venueByName['Yellow Gym (Newton)'];
  const online = venueByName['On line'];

  // Coach-to-primary-venue mapping based on metadata and club knowledge
  // Coaches with both Newton and Wellesley: assign primary based on first listed location
  // Coaches without specific location: default to Blue Gym (Newton) as main facility
  const coachVenueMap: Record<string, string> = {
    'Alex Kushkov': blueGym,       // Works both, primary Newton
    'Anya Kushkov': blueGym,       // No specific location, default Newton
    'Ben Kushkov': blueGym,        // No specific location, default Newton
    'Dima Kosmin': whiteGym,       // Primary Wellesley
    'Harrison Hue': whiteGym,      // Primary Wellesley
    'Eva Jelison': blueGym,        // No specific location, default Newton
    'Simon Kushkov': blueGym,      // No specific location, default Newton
    'Kiryl Kirpichou': blueGym,    // Primary Newton
    'Yelyzaveta Melnychuk': blueGym, // No specific location
    'Nina Nadtocheva': blueGym,    // Listed as "Foil" - Newton
    'Lukas Eichhorn': blueGym,     // No specific location, default Newton
    'Maude Niemann': blueGym,      // Admin/coach, default Newton
  };

  // Get coaches from DB
  const { data: coaches } = await supabase
    .from('club_members')
    .select('id, display_name')
    .eq('club_id', CLUB_ID)
    .eq('role', 'coach');

  const coachIdToVenue: Record<string, string> = {};
  for (const coach of coaches || []) {
    const venue = coachVenueMap[coach.display_name];
    if (venue) {
      coachIdToVenue[coach.id] = venue;
    }
  }

  // Update availability slots
  console.log('--- Updating availability slots ---');
  const { data: slots } = await supabase
    .from('availability_slots')
    .select('id, coach_member_id')
    .eq('club_id', CLUB_ID)
    .is('venue_id', null);

  let slotsUpdated = 0;
  for (const slot of slots || []) {
    const venueId = coachIdToVenue[slot.coach_member_id];
    if (venueId) {
      const { error } = await supabase
        .from('availability_slots')
        .update({ venue_id: venueId })
        .eq('id', slot.id);
      if (!error) slotsUpdated++;
    }
  }
  console.log(`  Updated ${slotsUpdated} / ${slots?.length || 0} slots`);

  // Update bookings with venue based on coach's primary venue
  console.log('\n--- Updating bookings with coach venue ---');
  let totalBookingsUpdated = 0;

  for (const coach of coaches || []) {
    const venueId = coachIdToVenue[coach.id];
    if (!venueId) continue;

    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', CLUB_ID)
      .eq('coach_member_id', coach.id)
      .is('venue_id', null);

    if (count && count > 0) {
      const { error } = await supabase
        .from('bookings')
        .update({ venue_id: venueId })
        .eq('club_id', CLUB_ID)
        .eq('coach_member_id', coach.id)
        .is('venue_id', null);

      if (error) {
        console.log(`  ${coach.display_name}: error updating ${count} bookings - ${error.message}`);
      } else {
        console.log(`  ${coach.display_name}: updated ${count} bookings → ${Object.entries(venueByName).find(([_, id]) => id === venueId)?.[0]}`);
        totalBookingsUpdated += count;
      }
    }
  }
  console.log(`  Total bookings updated: ${totalBookingsUpdated}`);

  // Verify
  console.log('\n--- Verification ---');
  const { count: nullVenueSlots } = await supabase
    .from('availability_slots')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID)
    .is('venue_id', null);
  console.log(`  Slots without venue: ${nullVenueSlots}`);

  const { count: nullVenueBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_ID)
    .is('venue_id', null);
  console.log(`  Bookings without venue: ${nullVenueBookings}`);

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
