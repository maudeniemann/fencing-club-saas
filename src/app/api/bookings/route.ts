import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasBookingConflict, hasPlayerConflict } from '@/lib/scheduling/conflict-check';
import { createLessonPaymentIntent } from '@/lib/stripe/payments';
import { addMinutes } from 'date-fns';
import { z } from 'zod';

const createBookingSchema = z.object({
  coach_member_id: z.string().uuid(),
  lesson_type_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  player_member_id: z.string().uuid(),
  venue_id: z.string().uuid().optional(),
  strip_id: z.string().uuid().optional(),
  is_recurring: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const coachId = searchParams.get('coach_id');

  let query = supabase
    .from('bookings')
    .select('*, lesson_types(name, category, duration_minutes, price_cents), coach:club_members!bookings_coach_member_id_fkey(display_name, avatar_url)')
    .order('starts_at', { ascending: true });

  if (status) query = query.eq('status', status);
  if (coachId) query = query.eq('coach_member_id', coachId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get current member
  const { data: currentMember } = await supabase
    .from('club_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!currentMember) return NextResponse.json({ error: 'No club membership' }, { status: 403 });

  // Parse and validate body
  const body = await request.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { coach_member_id, lesson_type_id, starts_at, player_member_id, venue_id, strip_id, notes } = parsed.data;

  // Get lesson type for duration and price
  const { data: lessonType } = await supabase
    .from('lesson_types')
    .select('*')
    .eq('id', lesson_type_id)
    .single();

  if (!lessonType) return NextResponse.json({ error: 'Lesson type not found' }, { status: 404 });

  const startsAtDate = new Date(starts_at);
  const endsAtDate = addMinutes(startsAtDate, lessonType.duration_minutes);
  const endsAt = endsAtDate.toISOString();

  // Double-booking prevention: check coach conflicts
  const coachConflict = await hasBookingConflict(admin, coach_member_id, starts_at, endsAt);
  if (coachConflict) {
    return NextResponse.json({ error: 'Coach is not available at this time' }, { status: 409 });
  }

  // Check player conflicts
  const playerConflict = await hasPlayerConflict(admin, player_member_id, starts_at, endsAt);
  if (playerConflict) {
    return NextResponse.json({ error: 'Player already has a booking at this time' }, { status: 409 });
  }

  // Get club for Stripe info
  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', currentMember.club_id)
    .single();

  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 });

  // Determine the payer (could be a parent booking for a child)
  let payer = currentMember;
  if (currentMember.role === 'parent' && player_member_id !== currentMember.id) {
    // Verify parent-child link
    const { data: link } = await supabase
      .from('parent_child_links')
      .select('*')
      .eq('parent_member_id', currentMember.id)
      .eq('child_member_id', player_member_id)
      .eq('can_book', true)
      .single();

    if (!link) {
      return NextResponse.json({ error: 'Not authorized to book for this player' }, { status: 403 });
    }
  }

  // Create booking
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      club_id: currentMember.club_id,
      coach_member_id,
      lesson_type_id,
      venue_id: venue_id || null,
      strip_id: strip_id || null,
      starts_at,
      ends_at: endsAt,
      duration_minutes: lessonType.duration_minutes,
      status: 'confirmed',
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Create Stripe payment intent
  let paymentIntent;
  let platformFeeCents = 0;
  let clubAmountCents = lessonType.price_cents;

  try {
    if (club.stripe_account_id && club.stripe_charges_enabled && payer.stripe_customer_id) {
      const result = await createLessonPaymentIntent({
        club,
        payer,
        lessonType,
        bookingId: booking.id,
        playerMemberId: player_member_id,
        coachMemberId: coach_member_id,
      });
      paymentIntent = result.paymentIntent;
      platformFeeCents = result.platformFeeCents;
      clubAmountCents = result.clubAmountCents;
    }
  } catch (stripeError) {
    // Rollback booking if payment fails
    await admin.from('bookings').delete().eq('id', booking.id);
    return NextResponse.json(
      { error: stripeError instanceof Error ? stripeError.message : 'Payment failed' },
      { status: 402 }
    );
  }

  // Create payment record
  const { data: payment } = await admin
    .from('payments')
    .insert({
      club_id: currentMember.club_id,
      booking_id: booking.id,
      payer_member_id: payer.id,
      player_member_id,
      stripe_payment_intent_id: paymentIntent?.id || null,
      amount_cents: lessonType.price_cents,
      platform_fee_cents: platformFeeCents,
      club_amount_cents: clubAmountCents,
      currency: lessonType.currency || 'usd',
      payment_type: 'lesson',
      status: paymentIntent ? 'processing' : 'pending',
    })
    .select()
    .single();

  // Create booking participant
  await admin.from('booking_participants').insert({
    club_id: currentMember.club_id,
    booking_id: booking.id,
    player_member_id,
    booked_by_member_id: currentMember.id,
    payment_id: payment?.id || null,
    price_charged_cents: lessonType.price_cents,
    status: 'confirmed',
  });

  // Create notification for coach
  await admin.from('notifications').insert({
    club_id: currentMember.club_id,
    recipient_member_id: coach_member_id,
    type: 'booking_confirmed',
    title: 'New Lesson Booked',
    body: `${payer.display_name || 'A player'} booked a ${lessonType.name} lesson.`,
    data: { booking_id: booking.id },
  });

  return NextResponse.json({
    booking,
    payment_intent_client_secret: paymentIntent?.client_secret || null,
  }, { status: 201 });
}
