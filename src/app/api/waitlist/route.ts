import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { z } from 'zod';

const joinWaitlistSchema = z.object({
  coach_member_id: z.string().uuid(),
  lesson_type_id: z.string().uuid(),
  desired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  desired_start_time: z.string().optional(),
  desired_end_time: z.string().optional(),
  player_member_id: z.string().uuid(),
  is_new_time_request: z.boolean().optional().default(false),
  request_notes: z.string().optional(),
});

export async function GET() {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { data } = await client
    .from('waitlist_entries')
    .select('*, coach:club_members!waitlist_entries_coach_member_id_fkey(display_name), lesson_types(name)')
    .or(`player_member_id.eq.${member.id},booked_by_member_id.eq.${member.id}`)
    .in('status', ['waiting', 'notified'])
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const body = await request.json();
  const parsed = joinWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { coach_member_id, lesson_type_id, desired_date, desired_start_time, desired_end_time, player_member_id, is_new_time_request, request_notes } = parsed.data;

  // Calculate booking history for priority scoring
  const { count: historyCount } = await client
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('coach_member_id', coach_member_id)
    .in('status', ['confirmed', 'completed']);

  const bookingHistoryCount = historyCount || 0;

  // Initial priority score (will be recalculated during cascade)
  const priorityScore = Math.min(100, bookingHistoryCount * 10) * 0.3;

  const { data: entry, error } = await client
    .from('waitlist_entries')
    .insert({
      club_id: member.club_id,
      coach_member_id,
      lesson_type_id,
      desired_date,
      desired_start_time: desired_start_time || null,
      desired_end_time: desired_end_time || null,
      player_member_id,
      booked_by_member_id: member.id !== player_member_id ? member.id : null,
      booking_history_count: bookingHistoryCount,
      priority_score: priorityScore,
      is_new_time_request: is_new_time_request || false,
      request_notes: request_notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(entry, { status: 201 });
}
