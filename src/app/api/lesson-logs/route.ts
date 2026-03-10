import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDemoSafeClient } from '@/lib/supabase/demo-client';
import { z } from 'zod';

const createLogSchema = z.object({
  booking_id: z.string().uuid(),
  player_member_id: z.string().uuid(),
  weapon: z.enum(['epee', 'foil', 'sabre']).optional(),
  focus_areas: z.array(z.string()).optional(),
  drills_performed: z.array(z.string()).optional(),
  notes: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  bout_scores: z.array(z.object({
    opponent: z.string(),
    score_for: z.number(),
    score_against: z.number(),
  })).optional(),
  is_visible_to_player: z.boolean().optional(),
  is_visible_to_parent: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { client: supabase, member } = await getDemoSafeClient();

  if (!member) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('player_id');
  const coachId = searchParams.get('coach_id');

  let query = supabase
    .from('lesson_logs')
    .select('*, coach:club_members!lesson_logs_coach_member_id_fkey(display_name), player:club_members!lesson_logs_player_member_id_fkey(display_name)')
    .eq('club_id', member.club_id)
    .order('created_at', { ascending: false });

  if (playerId) query = query.eq('player_member_id', playerId);
  if (coachId) query = query.eq('coach_member_id', coachId);

  const { data } = await query.limit(50);
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: member } = await supabase
    .from('club_members')
    .select('id, club_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'coach') {
    return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: log, error } = await supabase
    .from('lesson_logs')
    .insert({
      club_id: member.club_id,
      coach_member_id: member.id,
      booking_id: parsed.data.booking_id,
      player_member_id: parsed.data.player_member_id,
      weapon: parsed.data.weapon || null,
      focus_areas: parsed.data.focus_areas || null,
      drills_performed: parsed.data.drills_performed || null,
      notes: parsed.data.notes || null,
      rating: parsed.data.rating || null,
      bout_scores: parsed.data.bout_scores || null,
      is_visible_to_player: parsed.data.is_visible_to_player ?? true,
      is_visible_to_parent: parsed.data.is_visible_to_parent ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark booking as completed
  await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', parsed.data.booking_id);

  await supabase
    .from('booking_participants')
    .update({ status: 'completed' })
    .eq('booking_id', parsed.data.booking_id);

  return NextResponse.json(log, { status: 201 });
}
