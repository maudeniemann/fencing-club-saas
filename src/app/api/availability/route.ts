import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedMember } from '@/lib/auth/get-authenticated-member';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAvailableSlots } from '@/lib/scheduling/availability';
import { addDays } from 'date-fns';
import { z } from 'zod';

const createSlotSchema = z.object({
  is_recurring: z.boolean(),
  day_of_week: z.number().min(0).max(6).optional(),
  slot_date: z.string().optional(),
  start_time: z.string(),
  end_time: z.string(),
  venue_id: z.string().uuid().optional(),
  strip_id: z.string().uuid().optional(),
  recurrence_start: z.string().optional(),
  recurrence_end: z.string().optional(),
  allowed_lesson_type_ids: z.array(z.string().uuid()).optional(),
  is_blocked: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  const { searchParams } = new URL(request.url);
  const coachId = searchParams.get('coach_id');
  const fromDate = searchParams.get('from') || new Date().toISOString().split('T')[0];
  const toDate = searchParams.get('to');

  if (coachId) {
    // Get computed available slots for a specific coach
    const admin = createAdminClient();
    const slots = await getAvailableSlots({
      supabase: admin,
      clubId: member.club_id,
      coachMemberId: coachId,
      dateFrom: new Date(fromDate),
      dateTo: toDate ? new Date(toDate) : addDays(new Date(fromDate), 28),
    });
    return NextResponse.json(slots);
  }

  // Get raw availability slots for current coach
  const { data } = await client
    .from('availability_slots')
    .select('*')
    .eq('coach_member_id', member.id)
    .order('start_time', { ascending: true });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedMember();
  if (auth.error) return auth.error;
  const { member, client } = auth;

  if (member.role !== 'coach' && member.role !== 'admin') {
    return NextResponse.json({ error: 'Coach or admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSlotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: slot, error } = await client
    .from('availability_slots')
    .insert({
      club_id: member.club_id,
      coach_member_id: member.id,
      ...parsed.data,
      venue_id: parsed.data.venue_id || null,
      strip_id: parsed.data.strip_id || null,
      allowed_lesson_type_ids: parsed.data.allowed_lesson_type_ids || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(slot, { status: 201 });
}
