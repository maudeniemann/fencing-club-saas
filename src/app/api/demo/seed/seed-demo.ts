import { createAdminClient } from '@/lib/supabase/admin';

// Helper to create dates relative to today
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function bookingNumber(): string {
  return `BK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const WEAPONS = ['epee', 'foil', 'sabre'] as const;
const FOCUS_AREAS = ['Footwork', 'Blade work', 'Distance', 'Timing', 'Tactics', 'Point control', 'Parry-riposte', 'Attack preparation'];
const DRILL_TYPES = ['Advance-retreat', 'Lunge drill', 'Fleche', 'Beat attack', 'Disengage', 'Counter-attack', 'Compound attack', 'Defense drill'];

export async function seedDemoData() {
  const admin = createAdminClient();

  // Check if demo club already exists
  const { data: existingClub } = await admin
    .from('clubs')
    .select('id')
    .eq('slug', 'demo')
    .single();

  if (existingClub) return; // Already seeded

  // 1. Create demo club
  const { data: club, error: clubError } = await admin
    .from('clubs')
    .insert({
      name: 'Fencing Academy Demo',
      slug: 'demo',
      address_line1: '123 Fencing Way',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      country: 'US',
      timezone: 'America/New_York',
      phone: '(212) 555-0199',
      email: 'info@fencingacademy.demo',
      website: 'https://fencingacademy.demo',
      default_commission_split: 0.70,
    })
    .select('id')
    .single();

  if (clubError || !club) throw new Error(`Failed to create demo club: ${clubError?.message}`);
  const clubId = club.id;

  // 2. Create auth users + members
  const membersToCreate = [
    { email: 'demo-admin@fencing-demo.local', name: 'Demo Admin', role: 'admin' as const, specialties: null, commission_rate: null },
    { email: 'demo-coach@fencing-demo.local', name: 'Alex Petrov', role: 'coach' as const, specialties: ['epee', 'foil'], commission_rate: 0.70 },
    { email: 'demo-coach2@fencing-demo.local', name: 'Maria Santos', role: 'coach' as const, specialties: ['sabre'], commission_rate: 0.65 },
    { email: 'demo-coach3@fencing-demo.local', name: 'James Chen', role: 'coach' as const, specialties: ['epee', 'foil', 'sabre'], commission_rate: 0.70 },
    { email: 'demo-coach4@fencing-demo.local', name: 'Sarah Kim', role: 'coach' as const, specialties: ['foil', 'epee'], commission_rate: 0.75 },
    { email: 'demo-player@fencing-demo.local', name: 'Jamie Rivera', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player2@fencing-demo.local', name: 'Morgan Ellis', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player3@fencing-demo.local', name: 'Sam Nakamura', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player4@fencing-demo.local', name: 'Taylor Brooks', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player5@fencing-demo.local', name: 'Jordan Park', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player6@fencing-demo.local', name: 'Casey Williams', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player7@fencing-demo.local', name: 'Riley Chen', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player8@fencing-demo.local', name: 'Avery Johnson', role: 'player' as const, specialties: null, commission_rate: null },
    { email: 'demo-player9@fencing-demo.local', name: 'Quinn Davis', role: 'player' as const, specialties: null, commission_rate: null },
  ];

  const memberIds: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  for (const m of membersToCreate) {
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: m.email,
      email_confirm: true,
      user_metadata: { full_name: m.name },
    });

    if (authError) {
      // If user exists, try to find them
      if (authError.message?.includes('already been registered')) {
        const { data: users } = await admin.auth.admin.listUsers();
        const existing = users?.users?.find(u => u.email === m.email);
        if (existing) {
          userIds[m.email] = existing.id;
        } else {
          continue;
        }
      } else {
        continue;
      }
    } else {
      userIds[m.email] = authUser.user.id;
    }

    const { data: member } = await admin
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: userIds[m.email],
        role: m.role,
        display_name: m.name,
        specialties: m.specialties,
        commission_rate: m.commission_rate,
        bio: m.role === 'coach' ? `Experienced ${m.specialties?.join('/') || 'fencing'} coach with years of competitive experience.` : null,
      })
      .select('id')
      .single();

    if (member) {
      memberIds[m.email] = member.id;
    }
  }

  // Convenience references
  const coachIds = [
    memberIds['demo-coach@fencing-demo.local'],
    memberIds['demo-coach2@fencing-demo.local'],
    memberIds['demo-coach3@fencing-demo.local'],
    memberIds['demo-coach4@fencing-demo.local'],
  ].filter(Boolean);

  const playerIds = [
    memberIds['demo-player@fencing-demo.local'],
    memberIds['demo-player2@fencing-demo.local'],
    memberIds['demo-player3@fencing-demo.local'],
    memberIds['demo-player4@fencing-demo.local'],
    memberIds['demo-player5@fencing-demo.local'],
    memberIds['demo-player6@fencing-demo.local'],
    memberIds['demo-player7@fencing-demo.local'],
    memberIds['demo-player8@fencing-demo.local'],
    memberIds['demo-player9@fencing-demo.local'],
  ].filter(Boolean);

  if (coachIds.length === 0 || playerIds.length === 0) {
    throw new Error('Failed to create demo members');
  }

  // 3. Create venues + strips
  const venueData = [
    { name: 'Main Salle', address: '123 Fencing Way, New York, NY 10001', strips: ['Strip 1', 'Strip 2', 'Strip 3', 'Strip 4'] },
    { name: 'Downtown Studio', address: '456 Broadway, New York, NY 10012', strips: ['Strip A', 'Strip B'] },
    { name: 'Outdoor Court', address: '789 Central Park West, New York, NY 10025', strips: ['Court 1'] },
  ];

  const venueIds: string[] = [];
  const stripIds: string[] = [];

  for (const v of venueData) {
    const { data: venue } = await admin
      .from('venues')
      .insert({ club_id: clubId, name: v.name, address: v.address })
      .select('id')
      .single();

    if (venue) {
      venueIds.push(venue.id);
      for (let i = 0; i < v.strips.length; i++) {
        const { data: strip } = await admin
          .from('strips')
          .insert({ club_id: clubId, venue_id: venue.id, name: v.strips[i], sort_order: i, is_active: true })
          .select('id')
          .single();
        if (strip) stripIds.push(strip.id);
      }
    }
  }

  // 4. Create lesson types
  const lessonTypeData = [
    { name: 'Private Lesson', category: 'private', duration_minutes: 30, max_participants: 1, price_cents: 8000, color: '#3b82f6', description: 'One-on-one coaching session' },
    { name: 'Extended Private', category: 'private', duration_minutes: 60, max_participants: 1, price_cents: 15000, color: '#6366f1', description: '60-minute intensive private session' },
    { name: 'Group Lesson', category: 'group', duration_minutes: 60, max_participants: 8, price_cents: 4000, color: '#22c55e', description: 'Small group training session' },
    { name: 'Beginner Clinic', category: 'clinic', duration_minutes: 90, max_participants: 20, price_cents: 3000, color: '#f59e0b', description: 'Introduction to fencing for beginners' },
    { name: 'Footwork Lab', category: 'group', duration_minutes: 45, max_participants: 6, price_cents: 5000, color: '#ec4899', description: 'Specialized footwork and agility training' },
  ];

  const lessonTypeIds: string[] = [];
  for (const lt of lessonTypeData) {
    const { data: lessonType } = await admin
      .from('lesson_types')
      .insert({ club_id: clubId, ...lt })
      .select('id')
      .single();
    if (lessonType) lessonTypeIds.push(lessonType.id);
  }

  // 5. Create availability slots (recurring weekly for each coach)
  const schedules = [
    { coachIdx: 0, days: [1, 3, 5], start: '09:00', end: '17:00' }, // MWF
    { coachIdx: 1, days: [2, 4], start: '10:00', end: '18:00' },     // TTh
    { coachIdx: 2, days: [1, 2, 3, 4, 5], start: '08:00', end: '14:00' }, // M-F mornings
    { coachIdx: 3, days: [1, 3, 4], start: '14:00', end: '20:00' },  // MWTh afternoons
  ];

  for (const sched of schedules) {
    if (!coachIds[sched.coachIdx]) continue;
    for (const day of sched.days) {
      await admin.from('availability_slots').insert({
        club_id: clubId,
        coach_member_id: coachIds[sched.coachIdx],
        venue_id: venueIds[0] || null,
        is_recurring: true,
        day_of_week: day,
        start_time: sched.start,
        end_time: sched.end,
        recurrence_start: dateStr(-30),
        recurrence_end: dateStr(90),
        is_blocked: false,
      });
    }
  }

  // 6. Create bookings with participants and payments
  const bookings: Array<{
    id?: string;
    coachIdx: number;
    ltIdx: number;
    playerIdx: number;
    daysOffset: number;
    startHour: number;
    status: string;
    isGroup?: boolean;
  }> = [];

  // 20 completed (past)
  for (let i = 0; i < 20; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: i % 2, // Private or Extended
      playerIdx: i % playerIds.length,
      daysOffset: -(i + 1) * 2, // spread over past ~40 days
      startHour: 9 + (i % 8),
      status: 'completed',
    });
  }

  // 15 confirmed (upcoming)
  for (let i = 0; i < 15; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: i % 2,
      playerIdx: i % playerIds.length,
      daysOffset: (i + 1) * 2,
      startHour: 10 + (i % 7),
      status: 'confirmed',
    });
  }

  // 10 cancelled
  for (let i = 0; i < 10; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: 0,
      playerIdx: (i + 3) % playerIds.length,
      daysOffset: -(i + 1) * 3,
      startHour: 11 + (i % 5),
      status: 'cancelled',
    });
  }

  // 5 no-shows
  for (let i = 0; i < 5; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: 0,
      playerIdx: (i + 5) % playerIds.length,
      daysOffset: -(i + 2) * 4,
      startHour: 14 + (i % 3),
      status: 'no_show',
    });
  }

  // 5 disputed
  for (let i = 0; i < 5; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: 1,
      playerIdx: (i + 2) % playerIds.length,
      daysOffset: -(i + 3) * 3,
      startHour: 15 + (i % 2),
      status: 'disputed',
    });
  }

  // 5 group bookings
  for (let i = 0; i < 5; i++) {
    bookings.push({
      coachIdx: i % coachIds.length,
      ltIdx: 2, // Group Lesson
      playerIdx: i % playerIds.length,
      daysOffset: i < 3 ? -(i + 1) * 5 : (i + 1) * 3,
      startHour: 16,
      status: i < 3 ? 'completed' : 'confirmed',
      isGroup: true,
    });
  }

  const createdBookingIds: string[] = [];
  const completedBookingData: Array<{ bookingId: string; coachId: string; playerId: string }> = [];

  for (const b of bookings) {
    const coachId = coachIds[b.coachIdx];
    const playerId = playerIds[b.playerIdx];
    if (!coachId || !playerId) continue;

    const ltId = lessonTypeIds[b.ltIdx] || lessonTypeIds[0];
    const lt = lessonTypeData[b.ltIdx] || lessonTypeData[0];
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + b.daysOffset);
    startsAt.setHours(b.startHour, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + lt.duration_minutes * 60 * 1000);

    const bookingInsert: Record<string, unknown> = {
      club_id: clubId,
      booking_number: bookingNumber(),
      coach_member_id: coachId,
      lesson_type_id: ltId,
      venue_id: venueIds[0] || null,
      strip_id: stripIds[0] || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_minutes: lt.duration_minutes,
      status: b.status,
    };

    if (b.status === 'cancelled') {
      bookingInsert.cancelled_at = daysAgo(Math.abs(b.daysOffset) - 1);
      bookingInsert.cancellation_reason = randomItem(['Schedule conflict', 'Feeling unwell', 'Travel plans changed']);
    }

    if (b.status === 'no_show') {
      bookingInsert.no_show_reported_at = startsAt.toISOString();
      bookingInsert.no_show_reported_by = coachId;
    }

    const { data: booking } = await admin
      .from('bookings')
      .insert(bookingInsert)
      .select('id')
      .single();

    if (!booking) continue;
    createdBookingIds.push(booking.id);

    if (b.status === 'completed' || b.status === 'no_show' || b.status === 'disputed') {
      completedBookingData.push({ bookingId: booking.id, coachId, playerId });
    }

    // Create booking participant
    const participantInsert: Record<string, unknown> = {
      club_id: clubId,
      booking_id: booking.id,
      player_member_id: playerId,
      booked_by_member_id: playerId,
      price_charged_cents: lt.price_cents,
      status: b.status,
    };

    await admin.from('booking_participants').insert(participantInsert);

    // Add extra participants for group bookings
    if (b.isGroup) {
      for (let g = 1; g <= 3; g++) {
        const extraPlayer = playerIds[(b.playerIdx + g) % playerIds.length];
        if (extraPlayer && extraPlayer !== playerId) {
          await admin.from('booking_participants').insert({
            club_id: clubId,
            booking_id: booking.id,
            player_member_id: extraPlayer,
            booked_by_member_id: extraPlayer,
            price_charged_cents: lt.price_cents,
            status: b.status,
          });
        }
      }
    }

    // Create payment for non-cancelled bookings
    if (b.status !== 'cancelled') {
      const paymentStatus = b.status === 'completed' ? 'succeeded' :
        b.status === 'no_show' ? 'succeeded' :
          b.status === 'confirmed' ? 'pending' : 'succeeded';

      await admin.from('payments').insert({
        club_id: clubId,
        booking_id: booking.id,
        payer_member_id: playerId,
        player_member_id: playerId,
        amount_cents: lt.price_cents,
        platform_fee_cents: Math.round(lt.price_cents * 0.05),
        club_amount_cents: Math.round(lt.price_cents * 0.95),
        currency: 'usd',
        payment_type: 'lesson',
        status: paymentStatus,
      });
    }
  }

  // 7. Create lesson logs for completed bookings
  for (const bd of completedBookingData) {
    const weapon = randomItem(WEAPONS);
    const focusCount = 2 + Math.floor(Math.random() * 3);
    const drillCount = 2 + Math.floor(Math.random() * 2);
    const focusAreas = [...FOCUS_AREAS].sort(() => Math.random() - 0.5).slice(0, focusCount);
    const drills = [...DRILL_TYPES].sort(() => Math.random() - 0.5).slice(0, drillCount);

    await admin.from('lesson_logs').insert({
      club_id: clubId,
      booking_id: bd.bookingId,
      coach_member_id: bd.coachId,
      player_member_id: bd.playerId,
      weapon,
      focus_areas: focusAreas,
      drills_performed: drills,
      notes: randomItem([
        'Good progress on attack preparation. Need to work on recovery speed.',
        'Excellent blade work today. Footwork still needs improvement.',
        'Strong performance in bout practice. Focus on maintaining distance.',
        'Great improvement in parry-riposte sequences. Keep up the momentum.',
        'Worked on timing and distance control. Player showing steady improvement.',
      ]),
      rating: 3 + Math.floor(Math.random() * 3), // 3-5
      is_visible_to_player: true,
      is_visible_to_parent: true,
    });
  }

  // 8. Create disputes
  const disputeStatuses: Array<{ status: string; resolved: boolean }> = [
    { status: 'open', resolved: false },
    { status: 'resolved_for_player', resolved: true },
    { status: 'dismissed', resolved: true },
  ];

  // Use some of the disputed bookings
  const disputedBookings = createdBookingIds.slice(-5);
  for (let i = 0; i < Math.min(3, disputedBookings.length); i++) {
    const ds = disputeStatuses[i];
    const disputeInsert: Record<string, unknown> = {
      club_id: clubId,
      booking_id: disputedBookings[i],
      filed_by_member_id: playerIds[i % playerIds.length],
      reason: randomItem([
        'Coach was 15 minutes late to the lesson',
        'Lesson was shorter than the scheduled duration',
        'The venue was unavailable and no alternative was offered',
      ]),
      status: ds.status,
    };

    if (ds.resolved) {
      disputeInsert.resolved_by = memberIds['demo-admin@fencing-demo.local'];
      disputeInsert.resolved_at = daysAgo(1);
      disputeInsert.resolution_notes = ds.status === 'resolved_for_player'
        ? 'Refund issued. Coaching staff reminded of punctuality policy.'
        : 'After review, the lesson was delivered as scheduled. No refund warranted.';
      disputeInsert.refund_amount_cents = ds.status === 'resolved_for_player' ? 8000 : 0;
    }

    await admin.from('disputes').insert(disputeInsert);
  }

  // 9. Create waitlist entries
  for (let i = 0; i < 4; i++) {
    await admin.from('waitlist_entries').insert({
      club_id: clubId,
      coach_member_id: coachIds[i % coachIds.length],
      lesson_type_id: lessonTypeIds[0],
      desired_date: dateStr(i + 3),
      desired_start_time: '10:00',
      desired_end_time: '10:30',
      player_member_id: playerIds[(i + 4) % playerIds.length],
      booked_by_member_id: playerIds[(i + 4) % playerIds.length],
      status: i === 0 ? 'waiting' : i === 1 ? 'notified' : i === 2 ? 'accepted' : 'expired',
      priority_score: 100 - i * 10,
      proximity_score: 80 + i * 5,
      booking_history_count: 5 + i,
    });
  }

  // 10. Create notifications for the demo admin
  const adminMemberId = memberIds['demo-admin@fencing-demo.local'];
  const coachMemberId = memberIds['demo-coach@fencing-demo.local'];
  const playerMemberId = memberIds['demo-player@fencing-demo.local'];

  if (adminMemberId) {
    const notifications = [
      { recipient: adminMemberId, type: 'booking_confirmed', title: 'New Booking', body: 'Jamie Rivera booked a Private Lesson with Alex Petrov', hours: 2 },
      { recipient: adminMemberId, type: 'dispute_filed', title: 'New Dispute Filed', body: 'A dispute has been filed for booking BK-DEMO-001', hours: 5 },
      { recipient: adminMemberId, type: 'member_joined', title: 'New Member', body: 'Quinn Davis joined the club as a player', hours: 24 },
      { recipient: adminMemberId, type: 'payout_ready', title: 'Payouts Ready', body: 'Coach payouts for this period are ready for review', hours: 48 },
    ];

    if (coachMemberId) {
      notifications.push(
        { recipient: coachMemberId, type: 'booking_confirmed', title: 'New Lesson Booked', body: 'Jamie Rivera booked a Private Lesson with you', hours: 1 },
        { recipient: coachMemberId, type: 'booking_cancelled', title: 'Lesson Cancelled', body: 'Morgan Ellis cancelled their upcoming lesson', hours: 8 },
        { recipient: coachMemberId, type: 'lesson_reminder', title: 'Upcoming Lesson', body: 'You have a lesson with Sam Nakamura tomorrow at 10:00 AM', hours: 12 },
      );
    }

    if (playerMemberId) {
      notifications.push(
        { recipient: playerMemberId, type: 'booking_confirmed', title: 'Booking Confirmed', body: 'Your Private Lesson with Alex Petrov is confirmed', hours: 1 },
        { recipient: playerMemberId, type: 'lesson_logged', title: 'Lesson Notes Available', body: 'Alex Petrov posted notes from your recent lesson', hours: 6 },
        { recipient: playerMemberId, type: 'waitlist_update', title: 'Waitlist Update', body: 'A spot opened up for your requested lesson', hours: 18 },
      );
    }

    for (const n of notifications) {
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - n.hours);
      await admin.from('notifications').insert({
        club_id: clubId,
        recipient_member_id: n.recipient,
        type: n.type,
        title: n.title,
        body: n.body,
        channel: 'in_app',
        is_read: n.hours > 24,
        created_at: createdAt.toISOString(),
      });
    }
  }

  // 11. Create a coach payout record
  if (coachIds[0]) {
    await admin.from('coach_payouts').insert({
      club_id: clubId,
      coach_member_id: coachIds[0],
      period_start: dateStr(-30),
      period_end: dateStr(-1),
      total_lesson_revenue_cents: 160000, // $1,600
      commission_rate: 0.70,
      coach_payout_cents: 112000, // $1,120
      club_retained_cents: 48000, // $480
      payout_method: 'stripe',
      status: 'approved',
      notes: 'Monthly payout for demo period',
    });
  }
}
